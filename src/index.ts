import express from "express";
import { FirebaseApp, FirebaseError, initializeApp } from "@firebase/app";
import {
  getFirestore,
  onSnapshot,
  doc,
  query,
  collection,
  where,
  documentId,
  getDocs,
} from "@firebase/firestore";
import { FirebaseStorage, getStorage } from "@firebase/storage";

import { Auth, getAuth } from "@firebase/auth";
import { UserRepo } from "./repos/user_repo";
import { ComranetError } from "./exception";
import http from "https";

import multer from "multer";
import {
  ConfirmUserData,
  MessageUserData,
  UserLogin,
} from "./entities/user_data";
import { FeatureRepo } from "./repos/feature_repo";
import { ChatRepo } from "./repos/chat_repo";
import { AddChat, ChatData } from "./entities/chat_data";
import { MessageRepo } from "./repos/message_repo";
import {
  MessageData,
  MessageDataWithNotification,
} from "./entities/message_data";
import expressWs from "express-ws";

let upload = multer({ limits: { fieldSize: 10 * 1024 * 1024 } });

require("dotenv").config();

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  databaseURL: process.env.DATABASE_URL,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
  measurementId: process.env.MEASUREMENT_ID,
};
let _expressApp = express();
_expressApp.use(express.json({ limit: "10mb" }));
_expressApp.use(
  express.urlencoded({ limit: "10mb", extended: true, parameterLimit: 50000 })
);
const expressApp = expressWs(_expressApp).app;

const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth: Auth = getAuth(firebaseApp);
const storage: FirebaseStorage = getStorage(firebaseApp);
const myAuth = new UserRepo(auth, db, storage);
const featureRepo = new FeatureRepo(db, storage);
const chatRepo = new ChatRepo(db, storage);
const messageRepo = new MessageRepo(db, storage);

expressApp.listen(3000, () => {
  console.log("The application is listening on port 3000");
});

expressApp.post("/register_user", upload.single("avatar"), async (req, res) => {
  try {
    let userInfo = req.body;
    let file = req.file?.buffer;
    let userData = await myAuth.registerUser(userInfo, file);

    res.status(200).send(userData);
  } catch (error: any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error.message);
  }
});

expressApp.get("/sign_in", async (req, res) => {
  try {
    let userLogin = req.body as UserLogin;

    var userData = await myAuth.login(userLogin);
    res.status(200).send(userData);
  } catch (error: any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error.message);
  }
});

expressApp.post(
  "/update_notification_id/:login/:notification_id",
  async (req, res) => {
    try {
      let notification_id: string = req.params.notification_id;
      let login: string = req.params.login;
      await myAuth.updateNotificationId(login, notification_id);
      res.sendStatus(200).end();
    } catch (error: any) {
      if (error instanceof ComranetError || error instanceof FirebaseError) {
        res.status(401).send(error.message).end();
      } else {
        res.sendStatus(500).end();
      }
      console.log(error);
    }
  }
);

expressApp.get("/users/reset-password/", async (req, res) => {
  try {
    let data: ConfirmUserData = req.body as ConfirmUserData;
    await myAuth.resetUserPassword(data);
    res.sendStatus(200).end();
  } catch (error: any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error);
  }
});

expressApp.get("/users/all", async (req, res) => {
  try {
    const data = await myAuth.getAllUsers();
    res.status(200).send(data);
  } catch (error: any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error);
  }
});

expressApp.get("/app/info/", async (_, res) => {
  try {
    const appInfo = await featureRepo.getAppInfo();
    res.status(200).send(appInfo);
  } catch (error: any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error);
  }
});

expressApp.get("/chats/", async (req, res) => {
  try {
    const userId = req.body["user_id"];
    const appInfo = await chatRepo.getChatList(userId);
    res.status(200).send(appInfo);
  } catch (error: any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error);
  }
});

expressApp.post("/chats/", upload.single("chat_photo"), async (req, res) => {
  try {
    let chatInfo = req.body as AddChat;
    let file = req.file?.buffer;
    await chatRepo.addChat(chatInfo, file);
    res.sendStatus(200);
  } catch (error: any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error.message);
  }
});

expressApp.get("/messages/:chat_id/", async (req, res) => {
  try {
    let lastTimestamp = req.body["last_timestamp"];
    let limit = req.body["limit"];
    const message: Array<MessageData> = await messageRepo.getMessages(
      req.params.chat_id,
      lastTimestamp,
      limit
    );
    res.status(200).send(message);
  } catch (error: any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error.message);
  }
});

const options = {
  method: "POST",
  hostname: "onesignal.com",
  path: "/api/v1/notifications",
  headers: {
    accept: "application/json",
    Authorization: "Basic " + process.env.ONE_SIGNAL_REST_API_KEY,
    "content-type": "application/json",
  },
};

expressApp.post("/messages/:chat_id/", async (_req, res) => {
  try {
    let msg = _req.body;
    console.log(msg);
    const messageData: MessageDataWithNotification =
      await messageRepo.addMessage(msg, _req.params.chat_id);
    res.status(200).send(JSON.stringify(messageData.message_data));

    let notifications = await chatRepo.getChatUserNotifications(
      messageData.message_data.chat_id
    );
    notifications = notifications.filter(
      (e) => e != messageData.notification_id
    );
    console.log(notifications.toString());
    if (notifications.length == 0) return;

    const req = http.request(options);
    const notif = JSON.stringify({
      app_id: process.env.ONE_SIGNAL_APP_ID,
      include_player_ids: notifications,
      contents: {
        en: JSON.stringify(messageData.message_data),
        ru: JSON.stringify(messageData.message_data),
      },
      name: "Euzhene Corp.",
    });
    req.write(notif);
    req.end();
  } catch (error: any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error.message);
  }
});

expressApp.get("/stickers/",async function(req,res){

  try{
    const stickers:Array<string> = await featureRepo.getStickers();

    res.status(200).send(stickers);

  }catch(error:any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(401).send(error.message).end();
    } else {
      res.sendStatus(500).end();
    }
    console.log(error.message);
  }
});

expressApp.ws("/chats/new/:user_id/", async function (ws, _req) {
  ws.on("error", function (error) {
    console.log(error.message);
  });

  const userId = _req.params.user_id;

  onSnapshot(
    query(collection(db, "chat_members"), where("user_id", "==", userId)),
    async (_) => {
      const chatIdList: string[] = await chatRepo.getAvailableChatId(userId);
      onSnapshot(
        query(
          collection(db, "chat_info"),
          where(documentId(), "in", chatIdList)
        ),
        async (querySnapshot) => {
          const chatInfoList: ChatData[] = [];
          for (let i = 0; i < querySnapshot.size; i++) {
            const doc = querySnapshot.docs[i];
            const chatId = doc.id;
            const chatData = await chatRepo.getChatData(chatId);
            chatInfoList.push(chatData);
          }
          ws.send(JSON.stringify(chatInfoList));
        }
      );
    }
  );
});
