const express = require("express");
const cors = require("cors");
require("dotenv").config()

const admin = require("firebase-admin");
const serviceAccount = require("./bloodaid-f4332-firebase-adminsdk-fbsvc-6daebc3a13.json");
admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
	});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const Stripe = require("stripe");

const stripe = Stripe(
	"sk_test_51Rel8QPC60YcOyoh8fkkpeqygoKk3Poah4RQoJbhSEikgc2QWQYLdAOHr7ynhqaFvgUDlxqdwM5yRDNJI9YWXZS200x7Ug5KuI"
);
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
		const blogs = client.db("BloodAid").collection("blogs");
		const donationsCollection = client.db("BloodAid").collection("funding");



		const verifyFirebaseToken=async(req, res, next)=>{
			const authHeader = req.headers?.authorization


			if(!authHeader || !authHeader.startsWith('Bearer ')){
				return res.status(401).send({message: 'unauthorized access'})
			}

			const token= authHeader.split(' ')[1]


			try{
			const decoded = await admin.auth().verifyIdToken(token)
			req.decoded = decoded
				next()
			}
			catch(error){
				return res.status(401).send({message: 'unauthorized access'})
			}

			
		}

		const verifyEmail=async(req, res, next)=>{
			if(req.query.email !== req.decoded.email){
				return res.status(403).send({message: 'unauthorized access'})
			}
			next()
		}

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

		app.get("/users",verifyFirebaseToken,verifyEmail, async (req, res) => {
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

		app.get("/totalUser", async (req, res) => {
			const result = await usersCollection.countDocuments();

			res.send(result);
		});


		app.get("/SearchedUsers", async (req, res) => {
			const { bloodGroup, district, upazila, page = 1, limit = 12 } = req.query;

			const query = {};
			if (bloodGroup) query.bloodGroup = bloodGroup;
			if (district) query.district = district;
			if (upazila) query.upazila = upazila;

			const skip = (parseInt(page) - 1) * parseInt(limit);
			const totalPage = Math.ceil(parseInt((await usersCollection.countDocuments(query))))
			const users = await usersCollection
				.find(query)
				.skip(skip)
				.limit(parseInt(limit))
				.toArray();

			res.send({ users, totalPage });
		});

		// GET /blogs
		app.get("/blogs", async (req, res) => {
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 3;
			const status = req.query.status 

			console.log(status);
			const skip = (page - 1) * limit;

			const filter = { };
			if(status){
				filter.status = status
			}

			const blog = await blogs
				.find(filter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.toArray();

			const totalCount = await blogs.countDocuments(filter);
			const totalPages = Math.ceil(totalCount / limit);

			res.send({
				blog,
				totalPages,
				currentPage: page,
			});
		});

		//get blog by id
		app.get("/blog/:id", async (req, res) => {
			const id = req.params.id;
			const result = await blogs.findOne({ _id: new ObjectId(id) });
			res.send(result);
		});

		//patch blog
		app.patch("/blog/:id", async (req, res) => {
			const id = req.params.id;
			const data = req.body;

			const result = await blogs.updateOne(
				{ _id: new ObjectId(id) },
				{ $set: data }
			);
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

		//admin parts

		app.get("/totalDonationRequests", async (req, res) => {
			const result = await donations.countDocuments();
			res.send(result);
		});

		app.get("/recent-users", async (req, res) => {
			const users = await usersCollection
				.find()
				.sort({ _id: -1 }) // sort by creation time descending
				.limit(5)
				.toArray();

			res.send(users);
		});

		//get total users
		app.get("/totalUsers", async (req, res) => {
			try {
				const page = parseInt(req.query.page) || 1;
				const limit = parseInt(req.query.limit) || 10;
				const status = req.query.status;
				const email = req.query.email;

				const query = {};

				if (status) {
					query.status = status; // "active" | "blocked"
				}

				if (email) {
					query.email = { $regex: email, $options: "i" }; // case-insensitive partial match
				}

				const totalUsers = await usersCollection.countDocuments(query);
				const totalPages = Math.ceil(totalUsers / limit);

				const users = await usersCollection
					.find(query)
					.skip((page - 1) * limit)
					.limit(limit)
					.toArray();

				res.send({ users, totalPages });
			} catch (error) {
				console.error("Error fetching users:", error.message);
				res.status(500).send({ error: "Internal Server Error" });
			}
		});

		app.patch("/users/:id", async (req, res) => {
			try {
				const id = req.params.id;
				const action = req.body.action;

				let updateDoc = {};

				switch (action) {
					case "block":
						updateDoc = { $set: { status: "blocked" } };
						break;
					case "unblock":
						updateDoc = { $set: { status: "active" } };
						break;
					case "makeVolunteer":
						updateDoc = { $set: { role: "volunteer" } };
						break;
					case "makeDonor":
						updateDoc = { $set: { role: "donor" } };
						break;
					case "makeAdmin":
						updateDoc = { $set: { role: "admin" } };
						break;
					default:
						return res.status(400).send({ error: "Invalid action" });
				}

				const result = await usersCollection.updateOne(
					{ _id: new ObjectId(id) },
					updateDoc
				);

				if (result.modifiedCount === 0) {
					return res
						.status(404)
						.send({ error: "User not found or already updated" });
				}

				res.send({ success: true });
			} catch (error) {
				console.error("Error updating user:", error.message);
				res.status(500).send({ error: "Internal Server Error" });
			}
		});

		app.post("/blogs", async (req, res) => {
			const blog = req.body;
			const result = await blogs.insertOne(blog);
			res.send(result);
		});

		// GET /blogs (with optional status filter)
		app.get("/blogs", async (req, res) => {
			const { status } = req.query;
			const query = status ? { status } : {};
			const blog = await blogs.find(query).sort({ createdAt: -1 }).toArray();
			res.send(blog);
		});

		// PATCH /blogs/:id (publish/unpublish)
		app.patch("/blogs/:id", async (req, res) => {
			const { id } = req.params;
			const { action } = req.body;

			const update = {};
			if (action === "publish") update.status = "published";
			else if (action === "unpublish") update.status = "draft";

			const result = await blogs.updateOne(
				{ _id: new ObjectId(id) },
				{ $set: update }
			);
			res.send(result);
		});

		// DELETE /blogs/:id
		app.delete("/blogs/:id", async (req, res) => {
			const { id } = req.params;
			const result = await blogs.deleteOne({ _id: new ObjectId(id) });
			res.send(result);
		});

		//funding

		app.post("/bulk", async (req, res) => {
			const users = req.body;
			const result = await donations.insertMany(users);
			res.send(result);
		});

		app.post("/api/donation/create-intent", async (req, res) => {
			const { amount } = req.body;
			try {
				const paymentIntent = await stripe.paymentIntents.create({
					amount,
					currency: "bdt",
					automatic_payment_methods: { enabled: true },
				});
				res.send({ clientSecret: paymentIntent.client_secret });
			} catch (err) {
				res.status(500).send({ error: err.message });
			}
		});

		// Save Donation
		app.post("/api/donation/save", async (req, res) => {
			const { name, email, amount } = req.body;
			const donation = { name, email, amount, date: new Date() };
			try {
				await donationsCollection.insertOne(donation);
				res.send({ success: true });
			} catch (err) {
				res.status(500).send({ error: err.message });
			}
		});

		// Get Recent Donations
		app.get("/api/donation/all", async (req, res) => {
			const donations = await donationsCollection
				.find()
				.sort({ date: -1 })
				.limit(10)
				.toArray();
			res.send(donations);
		});

		//get total donation
		app.get("/totalDonations", async (req, res) => {
			const result = await donationsCollection
				.aggregate([
					{
						$group: {
							_id: null,
							totalDonation: { $sum: "$amount" },
						},
					},
				])
				.toArray();
			const total = result[0]?.totalDonation || 0;
			res.send(total);
		});

		app.get('/donors', async(req, res)=>{
			const id = req.query.id;
			const query = {}
			if(id){
				query._id = new ObjectId(id)
			}
			const result = await usersCollection.findOne(query)
			res.send(result)
		})

		app.get("/", (req, res) => {
			res.send("hlw world");
		});

		app.listen(port, () => {
			console.log(`server running on the port ${port}`);
		});
		
	} finally {
	}
}
run().catch(console.dir);
