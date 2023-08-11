import {
  CollectionReference,
  DocumentData,
  Firestore,
  Timestamp,
  addDoc,
  collection,
  doc,
  documentId,
  endAt,
  endBefore,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from "@firebase/firestore";
import { FirebaseStorage } from "@firebase/storage";
import { v4 as uuidv4 } from "uuid";

import {
  GetMessageData,
  MessageData,
  MessageDataWithNotification,
  SendFirebaseMessageData,
} from "../entities/message_data";
import { MessageUserData } from "../entities/user_data";
import { BaseRepo } from "./base_repo";

export class MessageRepo extends BaseRepo {
  constructor(db: Firestore, storage: FirebaseStorage) {
    super(db, storage);
  }

  public async getMessages(
    chatId: string,
    lastTimestamp: number | null,
    _limit: number | undefined
  ): Promise<Array<MessageData>> {
    if (_limit == undefined) _limit = 10;
    const messages: Array<MessageData> = [];

    let messageQuery;
    if (lastTimestamp != null) {
      messageQuery = query(
        this.messageRef,
        where("chat_id", "==", chatId),
        orderBy("timestamp", "desc"),
        startAfter(Timestamp.fromMillis(lastTimestamp)),
        limit(_limit)
      );
    } else
      messageQuery = query(
        this.messageRef,
        where("chat_id", "==", chatId),
        orderBy("timestamp", "desc"),
        limit(_limit)
      );

    const messageSnap = await getDocs(messageQuery);
    if (messageSnap.size == 0) return messages;

    for (let i = 0; i < messageSnap.docs.length; i++) {
      const json = messageSnap.docs[i].data();
      const userSnapshot = await this.findUserDataById(json["sender_id"]);
      const userData = new MessageUserData(
        userSnapshot.id,
        userSnapshot.data()["username"],
        userSnapshot.data()["photo_url"]
      );
      const message = new MessageData(
        json["data"],
        json["type"],
        json["timestamp"].toMillis(),
        json["chat_id"],
        userData,
        messageSnap.docs[i].id
      );
      messages.push(message);
    }

    return messages;
  }

  public async addMessage(data: any, chat_id:string): Promise<MessageDataWithNotification> {
    console.log(data);
    const timestamp = Timestamp.now();
    const messageFirebaseData = new SendFirebaseMessageData(
      data["content"],
      data["type"],
      timestamp,
      chat_id,
      data["user_id"]
    );
    const uploadedMessageId = uuidv4();
    await setDoc(doc(this.messageRef,uploadedMessageId), messageFirebaseData.toObject());
    await updateDoc(doc(this.chatRef,messageFirebaseData.chat_id),{"last_message_id":uploadedMessageId});
    const userSnapshot = await this.findUserDataById(
      messageFirebaseData.user_id
    );
    const userData = MessageUserData.fromSnapshot(userSnapshot);

    const messageData = new MessageData(
      messageFirebaseData.content,
      messageFirebaseData.type,
      timestamp.toMillis(),
      messageFirebaseData.chat_id,
      userData,
      uploadedMessageId,
    );

    return new MessageDataWithNotification(messageData, data["notification_id"]);
  }
}
