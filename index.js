const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
		const myDonations = client.db("BloodAid").collection("myDonations");

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
			const id = req.query.id;
			if (email) {
				query.email = email;
				const result = await usersCollection.findOne(query);
				res.send(result);
				return;
			}
			if (id) {
				query._id = new ObjectId(id);
				const result = await usersCollection.findOne(query);
				res.send(result);
				return;
			}
			const { bloodGroup, district, upazila } = req.query;
			if (bloodGroup) query.bloodGroup = bloodGroup;
			if (district) query.district = district;
			if (upazila) query.upazila = upazila;
         

			const result = await usersCollection.find(query).toArray();
			res.send(result);
		});

		//donation request part

		app.post("/createDonation", async (req, res) => {
			const donation = req.body;

			const result = await donations.insertOne(donation);
			res.send(result);
		});

		app.get("/donationRequests", async (req, res) => {
			const { email, status = "", page, bloodGroup, district, sort } = req.query;
			const limit = 6;
			const skip = (parseInt(page) - 1) * limit;
			const filter = {};
			if (email) {
				filter.requesterEmail = email;
			}

			if (status) filter.status = status;

			if (bloodGroup) filter.bloodGroup = bloodGroup;

			// Search by district
			if (district) {
				filter.recipientDistrict = { $regex: district, $options: "i" }; // case-insensitive
			}

			const sortQuery = {};
			if (sort === "asc") sortQuery.donationDate = 1;
			if (sort === "desc") sortQuery.donationDate = -1;

			const data = await donations
				.find(filter)
				.skip(skip)
				.limit(limit)
				.sort(sortQuery)
				.toArray();

			const total = await donations.countDocuments(filter);
			const totalPages = Math.ceil(total / limit);

			res.send({ data, totalPages });
		});

		app.get("/recent", async (req, res) => {
			const { email, limit, sort } = req.query;
			

			const result = await donations
				.find({ requesterEmail: email })
				.limit(parseInt(limit))
				.sort({ donationDate: -1 })
				.toArray();
			res.send(result);
		});
		app.patch("/donationRequests/:id", async (req, res) => {
			const id = req.params.id;
			const query = {};
			if (id) {
				query._id = new ObjectId(id);
			}

			const status = req.body;

			const result = await donations.updateOne(query, { $set: status });
			res.send(result);
		});

		app.get("/donationRequest/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await donations.findOne(query);
			res.send(result);
		});

		app.post("/myDonations", async (req, res) => {
			const myDonation = req.body;
			const result = await myDonations.insertOne(myDonation);
			res.send(result);
		});

		app.get("/myDonations", async (req, res) => {
			const email = req.query.email;
		
			const result = await myDonations.find({ donorEmail: email }).toArray();
			res.send(result);
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
