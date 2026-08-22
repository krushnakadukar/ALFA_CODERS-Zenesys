import { config } from "./config.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`OrgFlow API listening on http://localhost:${config.PORT}`);
});
