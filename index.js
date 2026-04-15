import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';


import {Client} from 'pg';

dotenv.config();

const dbHost = process.env.DB_HOST === 'postgres' ? 'localhost' : process.env.DB_HOST;
const dbPort = Number(process.env.DB_PORT || 5432);
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;

if (!dbUser || !dbName) {
    throw new Error('Missing required DB config. Set DB_USER and DB_NAME in your environment or .env file.');
}

const client = new Client({
user: dbUser,
password: typeof dbPassword === 'string' ? dbPassword : '',
host: dbHost,
port: dbPort,
database: dbName,
});

await client.connect();
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/verify-device/:id",async(req,res)=>{

 const data = await client.query("select * from devices where device_id = $1",[req.params.id]);
 if(data){
    return res.status(200).send("DEVICE VERIFIED: Alloted to "+data.rows[0].uid);

 }


})

app.listen(3000,async(req,res)=>{
    console.log("server running on port 3000");
})

