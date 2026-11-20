import { MongoClient } from "mongodb";
import { createApp } from "./app.js";
import { InMemoryTaskStore, MongoTaskStore, type Task, type TaskStore } from "./store.js";

const port = Number(process.env.PORT ?? 3001);
const mongoUrl = process.env.MONGO_URL;

async function buildStore(): Promise<TaskStore> {
  if (!mongoUrl) {
    console.warn("MONGO_URL not set, using in-memory store");
    return new InMemoryTaskStore();
  }
  const client = await MongoClient.connect(mongoUrl);
  const db = client.db(process.env.MONGO_DB ?? "taskmanager");
  const ping = async () => {
    await db.command({ ping: 1 });
    return true;
  };
  return new MongoTaskStore(db.collection<Task>("tasks"), ping);
}

const store = await buildStore();
createApp(store).listen(port, () => console.log(`task-service listening on :${port}`));
