import {
  CollectionReference,
  DocumentData,
  Firestore,
  addDoc,
  collection,
  documentId,
  getDocs,
  query,
  setDoc,
  where,
} from "@firebase/firestore";
import {
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytes,
} from "@firebase/storage";
import { AddChat, ChatData } from "../entities/chat_data";
import { MemberData } from "../entities/member_data";
import { v4 as uuidv4 } from "uuid";
import { MessageData } from "../entities/message_data";
import { MessageUserData } from "../entities/user_data";
import { BaseRepo } from "./base_repo";

export class ChatRepo extends BaseRepo {

  constructor(db: Firestore, storage: FirebaseStorage) {
    super(db,storage);
  }

  public async getChatList(userId: string): Promise<Array<ChatData>> {
    const chatList: Array<ChatData> = [];
    const availableChatsQuery = query(
      this.membersRef,
      where("user_id", "==", userId)
    );
    const availableChatsSnapshot = await getDocs(availableChatsQuery);
    if (availableChatsSnapshot.size == 0) return chatList;

    const availableChatsId: Array<string> = availableChatsSnapshot.docs.map(
      (value) => value.data()["chat_id"]
    );
    const chatListQuery = query(
      this.chatRef,
      where(documentId(), "in", availableChatsId)
    );
    const chatListSnapshot = await getDocs(chatListQuery);
    if (chatListSnapshot.size == 0) return chatList;

    //<----Perhaps it's excessive
    const lastMessagesQuery = query(
      this.chatRef,
      where("chat_id", "in", availableChatsId)
    );
    const lastMessagesSnapshot = await getDocs(lastMessagesQuery);
    //----->

  

    for (let i = 0; i < chatListSnapshot.size; i++) {
      const chatData: ChatData = new ChatData();
      chatData.title = chatListSnapshot.docs[i].data()["chat_name"];
      chatData.photo_url = chatListSnapshot.docs[i].data()["photo_url"];
      const chatId = chatListSnapshot.docs[i].id;
      chatData.chat_id = chatId;
      let lastMessageSnapshot = null;
      let lastMessage: MessageData | undefined;
      if (lastMessagesSnapshot.size > 0) {
        lastMessageSnapshot = lastMessagesSnapshot.docs
          .find((el) => el.data()["chat_id"] == chatId)!;
        const userSnapshot = await this.findUserDataById(lastMessageSnapshot.data()["sender_id"]);
        const userData = new MessageUserData(
          userSnapshot.id,
          userSnapshot.data()["username"],
          userSnapshot.data()["photo_url"]
        );
        lastMessage = new MessageData(
          lastMessageSnapshot.data()["data"],
          lastMessageSnapshot.data()["type"],
          lastMessageSnapshot.data()["timestamp"],
          lastMessageSnapshot.data()["chat_id"],
          userData,
          lastMessageSnapshot.id,
        );
      }

      chatData.last_message_data = lastMessage;
      chatList.push(chatData);
    }

    return chatList;
  }

  public async addChat(
    chatData: AddChat,
    chatPhoto: Buffer | undefined
  ): Promise<void> {
    let photoUrl: string | null = null;
    if (chatPhoto != undefined) {
      let uid = uuidv4();
      let storRef = ref(this.storage, `users_photo/${uid}`);

      let result = await uploadBytes(storRef, chatPhoto);

      photoUrl = await getDownloadURL(result.ref);
    }

    const chatInfoRef = await addDoc(this.chatRef, {
      chat_name: chatData.title,
      photo_url: photoUrl,
      owner_id: chatData.owner_id,
    });

    const chatId = chatInfoRef.id;
    chatData.user_id_list.forEach(async (id) => {
      await addDoc(this.membersRef, {
        user_id: id,
        chat_id: chatId,
      });
    });
  }
}
