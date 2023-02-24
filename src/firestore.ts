import { Firestore } from "@firebase/firestore";

export class CNetFirestore {
    private db:Firestore;

    constructor(db:Firestore) {
        this.db = db;
    }

}