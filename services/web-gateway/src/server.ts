import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const taskServiceUrl = process.env.TASK_SERVICE_URL ?? "http://localhost:3001";

createApp(taskServiceUrl).listen(port, () => console.log(`web-gateway listening on :${port}`));
