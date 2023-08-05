import { Firestore, CollectionReference, DocumentData, collection, documentId, getDocs, query, where, QuerySnapshot, QueryDocumentSnapshot } from "@firebase/firestore";
import { FirebaseStorage } from "@firebase/storage";
import { UserFirestore } from "../entities/user_data";
import { ComranetError } from "../exception";

export class BaseRepo {
    protected db: Firestore;
    protected storage: FirebaseStorage;
    protected membersRef: CollectionReference<DocumentData>;
    protected chatRef: CollectionReference<DocumentData>;
    protected usersRef: CollectionReference<DocumentData>;
    protected messageRef: CollectionReference<DocumentData>;

    constructor(db: Firestore, storage: FirebaseStorage) {
        this.db = db;
        this.storage = storage;
        this.membersRef = collection(this.db, "chat_members");
        this.chatRef = collection(this.db, "chat_info");
        this.usersRef = collection(this.db, "users");
        this.messageRef = collection(this.db, "messages");
      }
    
      protected async findUserDataById(id:string):Promise<QueryDocumentSnapshot> {
        const userQuery = query(this.usersRef, where(documentId(), "==", id));
        var snapshot = await getDocs(userQuery);
        if (snapshot.size == 0)
          throw new ComranetError("Пользователь не существует");
    
        return snapshot.docs[0];
      }
}