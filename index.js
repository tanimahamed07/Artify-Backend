const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");
require("dotenv").config();

const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64"
).toString("utf8");

const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const verifyFireBaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  console.log(authorization);
  if (!authorization) {
    return res.status(401).send({ message: "unauthorize access" });
  }
  const token = authorization.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.token_email = decoded.email;
    next();
  } catch (error) {
    console.log(error);

    return res.status(401).send({ message: "unautorize access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.2ss8g4p.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

async function run() {
  try {
    // await client.connect();
    const db = client.db("ARTIFY_DB");
    const modelCollection = db.collection("Artworks");
    const favoriteCollecton = db.collection("favorite");

    app.get("/latest-artworks", async (req, res) => {
      const result = await modelCollection
        .find({ visibility: true })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send({
        success: true,
        result,
      });
    });


app.get("/all-artworks", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    // ১. সার্চ এবং ক্যাটাগরি ফিল্টার অবজেক্ট তৈরি
    const search = req.query.search || "";
    const category = req.query.category || "";
    const sortOrder = req.query.sort || "newest";

    let query = { visibility: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { artistName: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      query.category = category;
    }

    // ২. সর্টিং অপশন সেট করা
    let sortOption = { createdAt: -1 }; 
    if (sortOrder === "priceLow") sortOption = { price: 1 };
    if (sortOrder === "priceHigh") sortOption = { price: -1 };
    if (sortOrder === "popular") sortOption = { likes: -1 };

    // ৩. টোটাল আইটেম সংখ্যা বের করা (ফিল্টার অনুযায়ী)
    const totalItems = await modelCollection.countDocuments(query);

    const result = await modelCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    res.send({
      success: true,
      result,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

    app.get("/update/:id", verifyFireBaseToken, async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const result = await modelCollection.findOne({ _id: new ObjectId(id) });
      res.send({
        success: true,
        result,
      });
    });
    app.get("/my-gallery", verifyFireBaseToken, async (req, res) => {
      const { email } = req.query;
      if (email !== req.token_email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await modelCollection
        .find({ artistEmail: email })
        .toArray();
      res.send({
        success: true,
        result,
      });
    });
    app.patch("/update-art/:id", verifyFireBaseToken, async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      const result = await modelCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      res.send({
        success: true,
        result,
      });
    });

    app.delete("/delete-artwork", verifyFireBaseToken, async (req, res) => {
      const { id } = req.query;
      const result = await modelCollection.deleteOne({ _id: new ObjectId(id) });
      res.send({
        success: true,
        result,
      });
    });
    app.post("/add-artworks", verifyFireBaseToken, async (req, res) => {
      const artWorks = req.body;
      const result = await modelCollection.insertOne(artWorks);
      res.send({
        success: true,
        result,
      });
    });
    app.get("/art-details/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const result = await modelCollection.findOne({ _id: new ObjectId(id) });
      const query = { artistEmail: result.artistEmail };
      const allArtByArtist = await modelCollection.find(query).toArray();
      res.send({
        success: true,
        result,
        allArtByArtist,
      });
    });
    app.put("/art-details/:id/like", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await modelCollection.updateOne(query, {
        $inc: { likes: 1 },
      });
      res.send({
        success: true,
        result,
      });
    });
    app.post("/fevorites", async (req, res) => {
      const favorite = req.body;
      console.log(favorite);
      const result = await favoriteCollecton.insertOne(favorite);
      res.send({
        success: true,
        result,
      });
    });
    app.get("/favorites-list", verifyFireBaseToken, async (req, res) => {
      const { email } = req.query;
      const query = { userEmail: email };
      const result = await favoriteCollecton.find(query).toArray();
      res.send({
        success: true,
        result,
      });
    });
    app.delete("/unFevorites", verifyFireBaseToken, async (req, res) => {
      const { id } = req.query;
      console.log(id);
      const result = await favoriteCollecton.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({
        success: true,
        result,
      });
    });

    app.get("/dashboard-overview", verifyFireBaseToken, async (req, res) => {
      const email = req.query.email;

      if (email !== req.token_email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      // user artworks
      const artworks = await modelCollection
        .find({ artistEmail: email })
        .toArray();

      // total artworks
      const totalArtworks = artworks.length;

      // total likes (sum)
      const totalLikes = artworks.reduce(
        (sum, art) => sum + (art.likes || 0),
        0
      );

      // favorites count
      const favoritesCount = await favoriteCollecton.countDocuments({
        userEmail: email,
      });

      res.send({
        success: true,
        data: {
          totalArtworks,
          totalLikes,
          favorites: favoritesCount,
        },
      });
    });

  app.get("/dashboard-overview", verifyFireBaseToken, async (req, res) => {
  try {
    const email = req.query.email;

    // security check
    if (email !== req.token_email) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const artworks = await artworksCollection
      .find({ artistEmail: email })
      .toArray();


    const totalArtworks = artworks.length;

    const totalLikes = artworks.reduce((sum, art) => {
      return sum + Number(art.likes || 0);
    }, 0);

    const favorites = await favoriteCollecton.countDocuments({
      userEmail: email,
    });

    res.send({
      success: true,
      data: {
        totalArtworks,
        totalLikes,
        favorites,
      },
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    res.status(500).send({
      success: false,
      message: "Server error",
    });
  }
});

    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. Successfully connected to MongoDB!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

run().catch((err) => console.error(err)); // Make sure to call the function

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
