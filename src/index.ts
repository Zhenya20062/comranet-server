import express, { Express } from "express";
import { FirebaseApp, FirebaseError, initializeApp } from "@firebase/app";
import { getFirestore, initializeFirestore } from "@firebase/firestore";
import bodyParser from "body-parser";
import { CNetFirestore } from "./firestore";
import { FirebaseStorage, getStorage } from "@firebase/storage";

import { User, Auth, getAuth, initializeAuth } from "@firebase/auth";
import { CNetAuth } from "./auth";
import { STATUS_CODES } from "http";
import { ComranetError } from "./exception";
import exp from "constants";

import multer from "multer";
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

const expressApp: Express = express();
expressApp.use(express.json({ limit: "10mb" }));
expressApp.use(
  express.urlencoded({ limit: "10mb", extended: true, parameterLimit: 50000 })
);

const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
//const myFirestore = new CNetFirestore(db);
const auth: Auth = getAuth(firebaseApp);
const storage: FirebaseStorage = getStorage(firebaseApp);
const myAuth = new CNetAuth(auth, db, storage);

expressApp.listen(3000, () => {
  console.log("The application is listening on port 3000");
});

expressApp.post("/register_user", upload.single("avatar"), async (req, res) => {
  try {
    let userInfo = req.body;
    let file = req.file?.buffer;
    let uid = await myAuth.registerUser(userInfo, file);

    res.status(200).send(uid);
  } catch (error:any) {
    if (error instanceof ComranetError || error instanceof FirebaseError) {
      res.status(303).send(error.message).end();
    }
    else {
      res.sendStatus(500) .end();
    }
    console.log(error.message);
  }
});

expressApp.post("/update_notification_id/:user_uid/:notification_id", async (req, res) => {
  try {
    let userUid:string = req.params.user_uid;
    let notificationId:string = req.params.notification_id;
    await myAuth.updateNotificationId(userUid, notificationId);
    res.sendStatus(200).end();
  } catch (error) {
    console.log(error);
  }
});
