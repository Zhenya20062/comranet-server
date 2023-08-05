import express, { Express } from "express";
import { FirebaseApp, FirebaseError, initializeApp } from "@firebase/app";
import { getFirestore } from "@firebase/firestore";
import { FirebaseStorage, getStorage } from "@firebase/storage";

import { Auth, getAuth } from "@firebase/auth";
import { UserRepo } from "./repos/user_repo";
import { ComranetError } from "./exception";

import multer from "multer";
import {
  ConfirmUserData,
  UserLogin,
} from "./entities/user_data";
import { FeatureRepo } from "./repos/feature_repo";
import { ChatRepo } from "./repos/chat_repo";
import { AddChat } from "./entities/chat_data";
import { MessageRepo } from "./repos/message_repo";
import { MessageData } from "./entities/message_data";
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
//const myFirestore = new CNetFirestore(db);
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


expressApp.ws("/messages/:chat_id/",function (ws,req){
  console.warn(req.params.chat_id);
  ws.on('message', async function(msg) {
    const json = JSON.parse(msg.toString());
   const messageData:MessageData = await messageRepo.addMessage(json);
    ws.send(JSON.stringify(messageData));
  });
  
});