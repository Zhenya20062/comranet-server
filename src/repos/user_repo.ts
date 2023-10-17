import {
  ActionCodeOperation,
  ActionCodeURL,
  Auth,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  sendPasswordResetEmail,
  updatePassword,
  User,
  verifyPasswordResetCode,
} from "@firebase/auth";
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
  QueryDocumentSnapshot,
} from "@firebase/firestore";
import {
  deleteObject,
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytes,
} from "@firebase/storage";
import { ComranetError } from "../exception";

import { v4 as uuidv4 } from "uuid";
import {
  ConfirmUserData,
  GetUserData,
  UpdateUserPassword as ResetUserPassword,
  UpdateUserData,
  UserData,
  UserFirestore,
  UserLogin,
} from "../entities/user_data";
import { signInWithEmailAndPassword } from "@firebase/auth";
import { UserInfo } from "os";

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

  private async findUserDataByLogin(login: string): Promise<UserFirestore> {
    var snapshot = await this.checkLoginExistence(login);
    return snapshot.data() as UserFirestore;
  }

  private async checkLoginExistence(
    login: string
  ): Promise<QueryDocumentSnapshot<DocumentData>> {
    const userQuery = query(this.usersRef, where("login", "==", login));
    var snapshot = await getDocs(userQuery);
    if (snapshot.size == 0) throw new ComranetError("Логин не существует");

    return snapshot.docs[0];
  }

  private async findUserIdByLogin(login: string): Promise<string> {
    var snapshot = await this.checkLoginExistence(login);
    return snapshot.id;
  }

  private async findUserDataById(id: string): Promise<UserFirestore> {
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
    if (snapshot.size == 0) throw new ComranetError("Логин не существует");

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

    await this.checkLogin(login);

    let user = (
      await createUserWithEmailAndPassword(this.auth, email, password)
    ).user;

    let photoUrl = await this.updatePhoto(photo, user.uid);

    userInfo["photo_url"] = photoUrl;

    await setDoc(doc(this.db, "users", user.uid), {
      email: email,
      login: login,
      photo_url: photoUrl,
      username: username,
    });

    userInfo["id"] = user.uid;

    return userInfo;
  }

  private async updatePhoto(
    photo: Buffer | undefined,
    userId: string
  ): Promise<string | undefined> {
    let storRef = ref(this.storage, `users_photo/${userId}`);
    if (photo != undefined) {
      let result = await uploadBytes(storRef, photo);

      return await getDownloadURL(result.ref);
    } else await deleteObject(storRef);
  }

  private async checkLogin(login: string): Promise<string> {
    login = login.trim();
    if (login.length == 0)
      throw new ComranetError("Логин не может быть пустым");

    const q = query(this.usersRef, where("login", "==", login));
    const snapshot = await getDocs(q);
    if (snapshot.size != 0) {
      throw new ComranetError("Такой логин занят");
    }

    return login;
  }

  private async checkEmail(email: string): Promise<string> {
    email = email.trim();
    if (email.length == 0)
      throw new ComranetError("Почта не может быть пустой");
    const q = query(this.usersRef, where("email", "==", email));
    const snapshot = await getDocs(q);
    if (snapshot.size != 0) {
      throw new ComranetError("Почта " + email + " уже используется");
    }
    return email;
  }

  private checkUsername(username: string): string {
    username = username.trim();
    if (username.length == 0) throw new ComranetError("Пустое имя недопустимо");
    return username;
  }

  public async updateNotificationId(
    login: string,
    notificationId: string
  ): Promise<void> {
    const userId = await this.findUserIdByLogin(login);
    await updateDoc(doc(this.db, "users", userId), {
      notification_id: notificationId,
    });
  }

  private async confirmUserData(
    confirmUserData: ConfirmUserData
  ): Promise<void> {
    const userData = await this.findUserDataByLogin(confirmUserData.login);
    if (userData.email != confirmUserData.email)
      throw new ComranetError("Почта не привязана к данному аккаунту");

    return;
  }

  public async resetUserPassword(data: ConfirmUserData): Promise<void> {
    await this.confirmUserData(data);
    await sendPasswordResetEmail(this.auth, data.email);
    return;
  }

  public async updateUserInfo(
    userId: string,
    userInfo: UpdateUserData
  ): Promise<void> {
    const normalizedUserInfo: UpdateUserData = await this.normalizeUserInfo(
      userInfo
    );

    let avatarUrl: undefined | string = "";
    if (normalizedUserInfo.avatar != null || userInfo.removeAvatar)
      avatarUrl = await this.updatePhoto(normalizedUserInfo.avatar, userId);

    let userData: Map<string, string> = new Map<string, string>();

    if (avatarUrl?.length == 0) userData.set("photo_url", avatarUrl);
    if (normalizedUserInfo.email != null)
      userData.set("email", normalizedUserInfo.email);
    if (normalizedUserInfo.login != null)
      userData.set("login", normalizedUserInfo.login);
    if (normalizedUserInfo.username != null)
      userData.set("username", normalizedUserInfo.username);
    
    await updateDoc(doc(this.db, "users", userId), JSON.parse(JSON.stringify( userData)));
  }

  private async normalizeUserInfo(
    userInfo: UpdateUserData
  ): Promise<UpdateUserData> {
    if (userInfo.email != null)
      userInfo.email = await this.checkEmail(userInfo.email);
    if (userInfo.login != null)
      userInfo.login = await this.checkLogin(userInfo.login);
    if (userInfo.username != null)
      userInfo.username = this.checkUsername(userInfo.username);

    return userInfo;
  }

  public async updateUserName(login: string, newName: string): Promise<void> {
    newName = this.checkUsername(newName);

    const userId = await this.findUserIdByLogin(login);
    await updateDoc(doc(this.db, "users", userId), {
      username: newName,
    });
  }

  public async getAllUsers(): Promise<Array<GetUserData>> {
    const userList: Array<GetUserData> = [];
    const userSnapshot = await getDocs(this.usersRef);
    userSnapshot.forEach((doc) => {
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
