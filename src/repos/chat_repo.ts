import {
  CollectionReference,
  DocumentData,
  DocumentSnapshot,
  Firestore,
  Timestamp,
  addDoc,
  collection,
  doc,
  documentId,
  getDoc,
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
import { timeStamp } from "console";

export class ChatRepo extends BaseRepo {
  constructor(db: Firestore, storage: FirebaseStorage) {
    super(db, storage);
  }

  public async getChatData(chatId:string):Promise<ChatData> {
    const chatInfoSnapshot = await getDoc(doc(this.chatRef, chatId));
    
    const chatInfo = new ChatData();
    chatInfo.chat_id = chatInfoSnapshot.id;
    chatInfo.photo_url = chatInfoSnapshot.data()!["photo_url"];
    chatInfo.title = chatInfoSnapshot.data()!["chat_name"];
    const lastMessageId = chatInfoSnapshot.data()!["last_message_id"];
    let lastMessage: MessageData | undefined;

    if (lastMessageId != null) {
      const lastMessagesQuery = query(
        collection(this.db, "messages"),
        where(documentId(), "==", lastMessageId)
      );
      const lls = (await getDocs(lastMessagesQuery)).docs[0];
      const userSnapshot = await this.findUserDataById(
        lls.data()["sender_id"]
      );
      const userData = new MessageUserData(
        userSnapshot.id,
        userSnapshot.data()["username"],
        userSnapshot.data()["photo_url"]
      );
      lastMessage = new MessageData(
        lls.data()["data"],
        lls.data()["type"],
        lls.data()["timestamp"].toMillis(),
        lls.data()["chat_id"],
        userData,
        lls.id
      );
    }

    chatInfo.last_message_data = lastMessage;

    return chatInfo;
  }

  public async getAvailableChatId(userId: string): Promise<string[]> {
    const availableChatsQuery = query(
      this.membersRef,
      where("user_id", "==", userId)
    );
    const availableChatsSnapshot = await getDocs(availableChatsQuery);
    if (availableChatsSnapshot.size == 0) return [];

    const availableChatsId: Array<string> = availableChatsSnapshot.docs.map(
      (value) => value.data()["chat_id"]
    );
    return availableChatsId;
  }

  public async getChatList(userId: string): Promise<Array<ChatData>> {
    const chatList: Array<ChatData> = [];
    // const availableChatsQuery = query(
    //   this.membersRef,
    //   where("user_id", "==", userId)
    // );
    // const availableChatsSnapshot = await getDocs(availableChatsQuery);
    // if (availableChatsSnapshot.size == 0) return chatList;

    // const availableChatsId: Array<string> = availableChatsSnapshot.docs.map(
    //   (value) => value.data()["chat_id"]
    // );
    const availableChatsId:string[] = await this.getAvailableChatId(userId);
    const chatListQuery = query(
      this.chatRef,
      where(documentId(), "in", availableChatsId)
    );
    const chatListSnapshot = await getDocs(chatListQuery);
    if (chatListSnapshot.size == 0) return chatList;

    //<----Perhaps it's excessive
    const lastMessagesQuery = query(
      this.chatRef,
      where(documentId(), "in", availableChatsId)
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
        lastMessageSnapshot = lastMessagesSnapshot.docs.find(
          (el) => el.id == chatId
        )!;
        if (lastMessageSnapshot.data()["last_message_id"] != null) {
          const lls = await this.getLastMessage(
            lastMessageSnapshot.data()["last_message_id"]
          );

          const userSnapshot = await this.findUserDataById(
            lls.data()["sender_id"]
          );
          const userData = new MessageUserData(
            userSnapshot.id,
            userSnapshot.data()["username"],
            userSnapshot.data()["photo_url"]
          );

          lastMessage = new MessageData(
            lls.data()["data"],
            lls.data()["type"],
            lls.data()["timestamp"].toMillis(),
            lls.data()["chat_id"],
            userData,
            lls.id
          );
        }
      }

      chatData.last_message_data = lastMessage;
      chatList.push(chatData);
    }

    return chatList;
  }

  async getLastMessage(messageId: string): Promise<any> {
    return await getDoc(doc(this.messageRef, messageId));
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

  public async getChatUserNotifications(
    chat_id: string
  ): Promise<Array<string>> {
    const membersSnapshot = (
      await getDocs(query(this.membersRef, where("chat_id", "==", chat_id)))
    ).docs;
    const userIdList = membersSnapshot.map((e) => e.data()["user_id"]);
    const usersSnapshot = (
      await getDocs(query(this.usersRef, where(documentId(), "in", userIdList)))
    ).docs;
    const res = usersSnapshot
      .map((e) => e.data()["notification_id"])
      .filter((e) => e != null);
    return res;
  }
}
