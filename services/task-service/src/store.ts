import { randomUUID } from "node:crypto";
import type { Collection } from "mongodb";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface TaskStore {
  list(): Promise<Task[]>;
  create(title: string): Promise<Task>;
  setDone(id: string, done: boolean): Promise<Task | null>;
  remove(id: string): Promise<boolean>;
  ping(): Promise<boolean>;
}

/** Used in tests and when no MONGO_URL is set. */
export class InMemoryTaskStore implements TaskStore {
  private tasks = new Map<string, Task>();

  async list(): Promise<Task[]> {
    return [...this.tasks.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async create(title: string): Promise<Task> {
    const task: Task = { id: randomUUID(), title, done: false, createdAt: new Date().toISOString() };
    this.tasks.set(task.id, task);
    return task;
  }

  async setDone(id: string, done: boolean): Promise<Task | null> {
    const task = this.tasks.get(id);
    if (!task) return null;
    task.done = done;
    return task;
  }

  async remove(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async ping(): Promise<boolean> {
    return true;
  }
}

export class MongoTaskStore implements TaskStore {
  constructor(
    private readonly collection: Collection<Task>,
    private readonly pingFn: () => Promise<boolean>,
  ) {}

  async list(): Promise<Task[]> {
    return this.collection.find({}, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
  }

  async create(title: string): Promise<Task> {
    const task: Task = { id: randomUUID(), title, done: false, createdAt: new Date().toISOString() };
    await this.collection.insertOne({ ...task });
    return task;
  }

  async setDone(id: string, done: boolean): Promise<Task | null> {
    return this.collection.findOneAndUpdate(
      { id },
      { $set: { done } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id });
    return result.deletedCount === 1;
  }

  async ping(): Promise<boolean> {
    return this.pingFn();
  }
}
