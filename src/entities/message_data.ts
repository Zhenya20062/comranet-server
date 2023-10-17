import { Timestamp } from "@firebase/firestore";
import { MessageUserData } from "./user_data";

export class MessageData {
  content!: string;
  type!: string;
  timestamp!: number;
  chat_id!: string;
  user_data!: MessageUserData;
  message_id!: string;
  edited!:boolean;

  constructor(
    content: string,
    type: string,
    timestamp: number,
    chat_id: string,
    user_data: MessageUserData,
    message_id: string,
    edited:boolean,
  ) {
    this.content = content;
    this.type = type;
    this.timestamp = timestamp;
    this.chat_id = chat_id;
    this.user_data = user_data;
    this.message_id = message_id;
    this.edited = edited;
  }

  toJson() {
    return {
      "content": this.content,
      "type": this.type,
      "timestamp": this.timestamp,
      "chat_id": this.chat_id,
      "user_data": this.user_data.toJson(),
      "message_id": this.message_id,
      "edited":this.edited,
    };
  }
}

export class SendFirebaseMessageData {
  content!: string;
  type!: string;
  timestamp!: Timestamp;
  chat_id!: string;
  user_id!: string;

  constructor(
    content: string,
    type: string,
    timestamp: Timestamp,
    chat_id: string,
    user_id: string
  ) {
    this.content = content;
    this.type = type;
    this.timestamp = timestamp;
    this.chat_id = chat_id;
    this.user_id = user_id;
  }

  public toObject() {
    return {
      data: this.content,
      chat_id: this.chat_id,
      sender_id: this.user_id,
      timestamp: this.timestamp,
      type: this.type,
    };
  }
}

// export class GetMessageData {
//   content!: string;
//   type!: string;
//   chat_id!: string;
//   user_id!: string;

//   constructor(content: string, type: string, chat_id: string, user_id: string) {
//     this.content = content;
//     this.type = type;
//     this.chat_id = chat_id;
//     this.user_id = user_id;
//   }
// }

export class UpdateMessageData {
  data!:string;
  user_id!:string;
}

export class MessageDataWithNotification {
  message_data!: MessageData;
  notification_id!: string | undefined;

  constructor(message_data: MessageData, notifcation_id: string | undefined) {
    this.message_data = message_data;
    this.notification_id = notifcation_id;
  }
}
