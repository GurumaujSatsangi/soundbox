import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { RekognitionClient, CompareFacesCommand } from "@aws-sdk/client-rekognition";
import fs from 'fs';

const rekognitionClient = new RekognitionClient({ region: "ap-south-1" });

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

async function loadImageBytes(imageSource) {
  if (/^https?:\/\//i.test(imageSource)) {
    const response = await fetch(imageSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${imageSource} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return fs.readFileSync(imageSource);
}

async function compareTwoFaces(sourceImagePath, targetImagePath) {
  try {
    const sourceImageBytes = await loadImageBytes(sourceImagePath);
    const targetImageBytes = await loadImageBytes(targetImagePath);

    // Set up the parameters for the API call
    const params = {
      SourceImage: {
        Bytes: sourceImageBytes,
      },
      TargetImage: {
        Bytes: targetImageBytes,
      },
      // Optional: Set a minimum similarity threshold (0-100)
      // AWS defaults to 80 if you don't specify this.
      SimilarityThreshold: 80, 
    };

    const command = new CompareFacesCommand(params);
    
    // Send the request to AWS
    const response = await rekognitionClient.send(command);

    // Process the response
    if (response.FaceMatches && response.FaceMatches.length > 0) {
      console.log("Match Found!");
      response.FaceMatches.forEach((match, index) => {
        console.log(`Match ${index + 1}: ${match.Similarity.toFixed(2)}% similarity`);
      });
    } else {
      console.log("No matching faces found above the threshold.");
    }

    if (response.UnmatchedFaces && response.UnmatchedFaces.length > 0) {
      console.log(`Found ${response.UnmatchedFaces.length} face(s) in the target image that did NOT match.`);
    }

    return response;

  } catch (error) {
    console.error("Error comparing faces:", error);
    throw error;
  }
}

app.post("/verify-device/:id",async(req,res)=>{
 try {
  const data = await client.query("select * from devices where device_id = $1",[req.params.id]);
  if(data.rowCount === 0){
    return res.status(404).send("Device not found");
  }

  const data2 = await client.query("select * from users where uid=$1", [data.rows[0].uid]);
  if (data2.rowCount === 0) {
    return res.status(404).send("User not found for device");
  }

  const result = await compareTwoFaces(
    data2.rows[0].image,
    'https://res.cloudinary.com/prarthana/image/upload/q_auto/f_auto/v1776271738/xabgcwssj2pbw4ayypgm.jpg'
  );
  return res.status(200).json(result);
 } catch (error) {
  return res.status(500).json({ error: error.message || 'Failed to verify device' });
 }

})

app.listen(3000,async(req,res)=>{
    console.log("server running on port 3000");
})

