const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASSWORD}@cluster0.rcnlifl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		await client.connect();

		await client.db("admin").command({ ping: 1 });

		const usersCollection = client.db("BloodAid").collection("users");
		const donations = client.db("BloodAid").collection("donations");

		app.post("/users", async (req, res) => {
			const userData = req.body;
			const result = await usersCollection.insertOne(userData);
			res.send(result);
		});

		app.patch("/updateUser", async (req, res) => {
			const email = req.query.email;
			const data = req.body;

			const result = await usersCollection.updateOne(
				{ email: email },
				{ $set: data }
			);
			res.send(result);
		});

		app.get("/users", async (req, res) => {
			const query = {};
			const email = req.query.email;
			if (email) {
				query.email = email;
			}
			const result = await usersCollection.findOne(query);
			res.send(result);
		});

		//donation request part

		app.post("/createDonation", async (req, res) => {
			const donation = req.body;

			const result = await donations.insertOne(donation);
			res.send(result);
		});

		app.get("/donationRequests", async (req, res) => {
			const { email, status = "", page = 1 } = req.query;
			const limit = 5;
			const skip = (parseInt(page) - 1) * limit;
            const filter = {}
            if(email){
                filter.requesterEmail= email
            }
			
			if (status) filter.status = status;

			const data = await donations
				.find(filter)
				.skip(skip)
				.limit(limit)
				.toArray();

			const total = await donations.countDocuments(filter);
			const totalPages = Math.ceil(total / limit);

			res.send({ data, totalPages });
		});

		app.get("/", (req, res) => {
			res.send("hlw world");
		});

		app.listen(port, () => {
			console.log(`server running on the port ${port}`);
		});
		console.log("Pinged your deployment. You successfully connected to MongoDB!");
	} finally {
	}
}
run().catch(console.dir);
