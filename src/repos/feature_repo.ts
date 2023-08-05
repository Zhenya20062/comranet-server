import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  FieldPath,
  Firestore,
  collection,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
} from "@firebase/firestore";
import { FirebaseStorage } from "@firebase/storage";
import { AppInfo } from "../entities/app_info";

export class FeatureRepo {
  private db: Firestore;
  private storage: FirebaseStorage;
  private appRef: CollectionReference<DocumentData>;

  constructor(db: Firestore, storage: FirebaseStorage) {
    this.db = db;
    this.storage = storage;

    this.appRef = collection(this.db, "additional");
  }

  public async getAppInfo(): Promise<AppInfo> {
    const q = query(this.appRef, where(documentId(), "==", "app_info"));
    const data = (await getDocs(q)).docs[0].data() as AppInfo;
    
    data.news = data.news.replace(new RegExp(/\\n/gi), '\n' );
    return data;
  }
}
