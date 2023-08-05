import { ActionCodeOperation, ActionCodeURL, Auth, confirmPasswordReset, createUserWithEmailAndPassword, EmailAuthProvider, sendPasswordResetEmail, updatePassword, User, verifyPasswordResetCode } from "@firebase/auth";
import {
  collection,
  Firestore,
  getDocs,
  where,
  query,
  setDoc,
  doc,
  updateDoc,
  FieldPath,
  documentId,
  CollectionReference,
  DocumentData,
  getDoc,
} from "@firebase/firestore";
import {
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytes,
} from "@firebase/storage";
import { ComranetError } from "../exception";

import { v4 as uuidv4 } from "uuid";
import { ConfirmUserData, GetUserData, UpdateUserPassword as ResetUserPassword, UserData, UserFirestore, UserLogin } from "../entities/user_data";
import { signInWithEmailAndPassword } from "@firebase/auth";

export class UserRepo {
  private db: Firestore;
  private auth: Auth;
  private storage: FirebaseStorage;
  private usersRef: CollectionReference<DocumentData>;

  constructor(auth: Auth, db: Firestore, storage: FirebaseStorage) {
    this.auth = auth;
    this.db = db;
    this.storage = storage;

    this.usersRef = collection(this.db, "users");
  }

  private async findUserDataByLogin(login:string):Promise<UserFirestore> {
    const userQuery = query(this.usersRef, where("login", "==", login));
    var snapshot = await getDocs(userQuery);
    if (snapshot.size == 0)
      throw new ComranetError("Логин не существует");

    return snapshot.docs[0].data() as UserFirestore;
  }

  private async findUserDataById(id:string):Promise<UserFirestore> {
    const userQuery = query(this.usersRef, where(documentId(), "==", id));
    var snapshot = await getDocs(userQuery);
    if (snapshot.size == 0)
      throw new ComranetError("Пользователь не существует");

    return snapshot.docs[0].data() as UserFirestore;
  }


  public async login(userLogin: UserLogin): Promise<UserData> {
    var userId;
    if (userLogin.login.includes("@")) {
      var userCreds = await signInWithEmailAndPassword(
        this.auth,
        userLogin.login,
        userLogin.password
      );
      userId = userCreds.user.uid;
    }

    var userQuery;
    if (userId != undefined) {
      userQuery = query(this.usersRef, where(documentId(), "==", userId));
    } else {
      userQuery = query(this.usersRef, where("login", "==", userLogin.login));
    }

    var snapshot = await getDocs(userQuery);
    if (snapshot.size == 0)
      throw new ComranetError("Логин не существует");

    var userData = new UserData();

    userData.email = snapshot.docs[0].data()["email"];
    userData.login = snapshot.docs[0].data()["login"];
    userData.avatarUrl = snapshot.docs[0].data()["photo_url"];
    userData.username = snapshot.docs[0].data()["username"];
    userData.password = userLogin.password;
    userData.id = snapshot.docs[0].id;

    if (!userLogin.login.includes("@"))
      await signInWithEmailAndPassword(
        this.auth,
        userData.email,
        userLogin.password
      );

    return userData;
  }

  public async registerUser(
    userInfo: any,
    photo: Buffer | undefined
  ): Promise<any> {
    let login: string = userInfo.login;
    let password: string = userInfo.password;
    let email: string = userInfo.email;
    let username: string = userInfo.username;

    let photoUrl: string | null = null;

    const q = query(this.usersRef, where("login", "==", login));
    const snapshot = await getDocs(q);
    if (snapshot.size != 0) {
      throw new ComranetError("Такой логин занят");
    }

    if (photo != undefined) {
      let uid = uuidv4();
      let storRef = ref(this.storage, `users_photo/${uid}`);

      let result = await uploadBytes(storRef, photo);

      photoUrl = await getDownloadURL(result.ref);
    }
    userInfo["photo_url"] = photoUrl;

    let user = (
      await createUserWithEmailAndPassword(this.auth, email, password)
    ).user;

    await setDoc(doc(this.db, "users", user.uid), {
      email: email,
      login: login,
      photo_url: photoUrl,
      username: username,
    });
    
    userInfo["id"] = user.uid;

    return userInfo;
  }

  public async updateNotificationId(
    login: string,
    notificationId: string
  ): Promise<void> {
    const q = query(this.usersRef, where("login", "==", login));
    var snapshot = await getDocs(q);
    if (snapshot.size == 0) throw new ComranetError("Не существующий логин " + login);
    const userId = snapshot.docs[0].id;
    await updateDoc(doc(this.db, "users", userId), {
      'notification_id': notificationId,
    });
  }

  private async confirmUserData(confirmUserData:ConfirmUserData) :Promise<void>{
    const userData = await this.findUserDataByLogin(confirmUserData.login);
    if (userData.email != confirmUserData.email) throw new ComranetError("Почта не привязана к данному аккаунту");

    return;
  }

  public async resetUserPassword(
    data:ConfirmUserData,
  ) : Promise<void> {
    await this.confirmUserData(data);
    await sendPasswordResetEmail(this.auth, data.email);
    return;
  }


  public async getAllUsers():Promise<Array<GetUserData>> {
    const userList:Array<GetUserData> = [];
    const userSnapshot = await getDocs(this.usersRef);
    userSnapshot.forEach((doc)=>{
      const userJson = doc.data();
      const userData = new GetUserData();
      userData.id = doc.id;
      userData.login = userJson["login"];
      userData.photo_url = userJson["photo_url"];
      userData.username = userJson["username"];

      userList.push(userData);
    });
    
    return userList;
  }
}
