import { QueryDocumentSnapshot } from "@firebase/firestore";

export class UserLogin {
  login!: string;
  password!: string;
}

export class UserData {
  login!: string;
  password?: string;
  avatarUrl?: string;
  email!: string;
  username!: string;
  id!: string;
}

export class UserFirestore {
  login!: string;
  avatarUrl?: string;
  email!: string;
  username!: string;
  notification_url!: string;
}

export class UpdateUserPassword {
  login!: string;
  password!: string;
}

export class ConfirmUserData {
  login!: string;
  email!: string;
}

export class GetUserData {
  id!: string;
  username!: string;
  login!: string;
  photo_url?: string;
}

export class UpdateUserData {
  login?: string;
  password?: string;
  avatar?: Buffer;
  email?: string;
  username?: string;
  removeAvatar?:boolean = false;
}

export class MessageUserData {
  id!: string;
  username!: string;
  photo_url?: string;

  constructor(id: string, username: string, photo_url: string | undefined) {
    this.id = id;
    this.username = username;
    this.photo_url = photo_url;
  }

  public static fromSnapshot(snapshot:QueryDocumentSnapshot) :MessageUserData{
    return new MessageUserData(snapshot.id,snapshot.data()["username"],snapshot.data()["photo_url"]);
  }

  toJson(){
    return {
      "id":this.id,
      "username":this.username,
      "photo_url":this.photo_url,
    };
  }
}
