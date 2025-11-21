require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

const routes = require("./routes/routes");
app.use("/", routes);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
