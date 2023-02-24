import { Auth, createUserWithEmailAndPassword, User } from "@firebase/auth";
import {
  collection,
  Firestore,
  getDocs,
  where,
  query,
  addDoc,
  setDoc,
  doc,
} from "@firebase/firestore";
import {
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadString,
} from "@firebase/storage";
import { ComranetError } from "./exception";

import { v4 as uuidv4 } from 'uuid';
import { arrayBuffer } from "stream/consumers";

export class CNetAuth {
  private db: Firestore;
  private auth: Auth;
  private storage: FirebaseStorage;

  constructor(
    auth: Auth,
    db: Firestore,
    storage: FirebaseStorage,
  ) {
    this.auth = auth;
    this.db = db;
    this.storage = storage;
  }

  public async registerUser(userInfo: any, photo:Buffer|undefined): Promise<string> {
    let login: string = userInfo.login;
    let password: string = userInfo.password;
    let email: string = userInfo.email;
    let username: string = userInfo.username;

    let photoUrl: string | null = null;

    const usersRef = collection(this.db, "users");

    const q = query(usersRef, where("login", "==", login));
    const snapshot = await getDocs(q);
    if (snapshot.size != 0) {
      throw new ComranetError("login is already taken");
    }

    if (photo != undefined) {
      let uid =uuidv4();
      let storRef = ref(this.storage, `users_photo/${uid}`);

      let result = await uploadBytes(storRef, photo);

      photoUrl = await getDownloadURL(result.ref);

    }

    let user = (
      await createUserWithEmailAndPassword(this.auth, email, password)
    ).user;

    await setDoc(doc(this.db, "users", user.uid), {
      email: email,
      login: login,
      photo_url : photoUrl,
      username:username,
    });

    return user.uid;
  }

  public async updateNotificationId(userUid:string, notificationId:string) {
      
      setDoc(doc(this.db, "users",userUid), {
        notification_id:notificationId
      });
      
      return;
  }
}
