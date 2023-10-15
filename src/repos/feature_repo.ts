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
import { FirebaseStorage, ListResult, StorageReference, getDownloadURL, listAll, ref } from "@firebase/storage";
import { AppInfo } from "../entities/app_info";

export class FeatureRepo {
  private db: Firestore;
  private storage: FirebaseStorage;
  private appRef: CollectionReference<DocumentData>;
  private stickerRef: StorageReference;

  constructor(db: Firestore, storage: FirebaseStorage) {
    this.db = db;
    this.storage = storage;

    this.appRef = collection(this.db, "additional");
    this.stickerRef = ref(this.storage, `stickers/`);
  }

  public async getAppInfo(): Promise<AppInfo> {
    const q = query(this.appRef, where(documentId(), "==", "app_info"));
    const data = (await getDocs(q)).docs[0].data() as AppInfo;
    
    data.news = data.news.replace(new RegExp(/\\n/gi), '\n' );
    return data;
  }


  public async getStickers():Promise<Array<string>> {

   const res:ListResult =  await listAll(this.stickerRef);
   const urls = await Promise.all(res.items.map((item) => getDownloadURL(item)));
  return urls;
  }
}
