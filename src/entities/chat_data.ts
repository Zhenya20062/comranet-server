import { MemberData } from "./member_data";
import { MessageData } from "./message_data";

export class ChatData {
    title!:string;
    photo_url?:string;
    last_message_data?:MessageData;
    chat_id!:string;
}


export class AddChat {
    title!:string;
    user_id_list!:Array<string>;
    owner_id!:string;
}