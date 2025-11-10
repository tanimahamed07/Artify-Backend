const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");
require('dotenv').config()

const serviceAccount = require("./artify-admin-key-token.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middleware 
app.use(cors());
app.use(express.json());

const verifyFireBaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: 'unauthorize access' })
  }
  const token = authorization.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.token_email = decoded.email;
    next()
  } catch {
    return res.status(401).send({ message: 'unautorize access' })
  }
}





const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.2ss8g4p.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res) => {
  res.send('Server is running');
});

async function run() {
  try {
    await client.connect();
    const db = client.db("ARTIFY_DB");
    const modelCollection = db.collection("Artworks");
    const favoriteCollecton = db.collection("favorite");


    app.get("/latest-artworks", async (req, res) => {
      const result = await modelCollection.find({ visibility: true }).sort({ createdAt: -1 }).limit(6).toArray();
      res.send({
        success: true,
        result,
      });
    });
    app.get('/all-artworks', async (req, res) => {
      const result = await modelCollection.find().toArray()
      res.send({
        success: true,
        result,
      });
    })
    app.get('/update/:id', async (req, res) => {
      const { id } = req.params;
      console.log(id)
      const result = await modelCollection.findOne({ _id: new ObjectId(id) });
      res.send(
        {
          success: true,
          result
        }
      )

    })
    app.get('/my-gallery', verifyFireBaseToken, async (req, res) => {
      const { email } = req.query;
      if (email !== req.token_email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const result = await modelCollection.find({ artistEmail: email }).toArray()
      res.send({
        success: true,
        result
      })
    })
    app.patch('/update-art/:id', async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      const result = await modelCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      res.send({
        success: true,
        result
      })
    })

    app.delete('/delete-artwork', async (req, res) => {
      const { id } = req.query;
      const result = await modelCollection.deleteOne({ _id: new ObjectId(id) });
      res.send({
        success: true,
        result
      })
    })
    app.post('/add-artworks', verifyFireBaseToken, async (req, res) => {
      const artWorks = req.body;
      // console.log(artWorks)
      const result = await modelCollection.insertOne(artWorks);
      res.send({
        success: true,
        result
      })

    })
    app.get('/art-details/:id', verifyFireBaseToken, async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const result = await modelCollection.findOne({ _id: new ObjectId(id) });
      const query = { artistEmail: result.artistEmail }
      const allArtByArtist = await modelCollection.find(query).toArray();
      res.send({
        success: true,
        result,
        allArtByArtist,
      });
    })
    app.put('/art-details/:id/like', async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) }
      const result = await modelCollection.updateOne(
        query,
        { $inc: { likes: 1 } })
      res.send({
        success: true,
        result
      })
    })
    app.post('/fevorites', async (req, res) => {
      const favorite = req.body;
      console.log(favorite)
      const result = await favoriteCollecton.insertOne(favorite);
      res.send({
        success: true,
        result
      })
    })
    app.get('/favorites-list', async (req, res) => {
      const { email } = req.query;
      const query = { userEmail: email };
      const result = await favoriteCollecton.find(query).toArray();
      res.send({
        success: true,
        result
      })
    })
    app.delete('/unFevorites', async (req, res) => {
      const { id } = req.query;
      console.log(id)
      const result = await favoriteCollecton.deleteOne({ _id: new ObjectId(id) });
      res.send({
        success: true,
        result,
      })
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Successfully connected to MongoDB!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}


run().catch(err => console.error(err)); // Make sure to call the function

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
