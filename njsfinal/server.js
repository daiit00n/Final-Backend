// server.js

const express = require('express');
const methodOverride = require('method-override');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const axios = require('axios');


const app = express();
app.use(methodOverride('_method'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const newsApiKey = '446ba869cc2c4af3bd5ea875a4065ecd';
const newsApiUrl = 'https://newsapi.org/v2/top-headlines';

const currencyExchangeApiKey = '9c70d07f89c49b8056cd633e';
const currencyExchangeApiUrl = 'https://open.er-api.com/v6/latest';

// Connect to MongoDB
mongoose.connect('mongodb+srv://mcswordyt:1234@cluster0.vgkl87j.mongodb.net/myblog?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Define user schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: String,
    lastName: String,
    age: Number,
    country: String,
    gender: String,
    role: { type: String, default: 'regular user' }
});

// Define user model
const User = mongoose.model('User', userSchema);

// Define blog schema
const blogSchema = new mongoose.Schema({
    title: String,
    content: String,
    titleRu: String, // Russian title
    contentRu: String, // Russian content
    images: [String], // Array of image URLs
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Define blog model
const BlogPost = mongoose.model('BlogPost', blogSchema);


// Use body-parser middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Serve static files (e.g., CSS, images)
app.use(express.static('public'));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false
}));

// Middleware to check if user is logged in
const requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/');
    }
};

// Middleware to check if user is not logged in
const requireLogout = (req, res, next) => {
    if (req.session && req.session.user) {
        res.redirect('/blogs');
    } else {
        next();
    }
};



// Route for serving the welcome page
app.get('/', (req, res) => {
    res.render('welcome', { user: req.session.user });
});


// Route for serving the registration form
app.get('/register', (req, res) => {
    res.render('register');
});

// Route for handling registration form submission
app.post('/register', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const newUser = new User({
            email: req.body.email,
            password: hashedPassword,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            age: req.body.age,
            country: req.body.country,
            gender: req.body.gender
        });

        await newUser.save();

        // Send welcome email
        sendWelcomeEmail(newUser.email);

        res.redirect('/login');
    } catch (error) {
        res.status(500).send('Error registering user');
    }
});

// Route for serving the login form
app.get('/login', (req, res) => {
    res.render('login');
});

// Route for handling login form submission
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user) {
            const isPasswordMatch = await bcrypt.compare(password, user.password);
            if (isPasswordMatch) {
                // Set user information in the session
                req.session.user = {
                    _id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role
                };

                // Redirect to the main page (or dashboard)
                res.redirect('/blogs');
            } else {
                res.status(401).send('Invalid email or password');
            }
        } else {
            res.status(401).send('User not found');
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Function to send welcome email
function sendWelcomeEmail(email) {
    // Create a Nodemailer transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'mcswordyt@gmail.com', // Your Gmail email address
            pass: 'uobt iqux enqh jiqm' // Your Gmail password
        }
    });

    // Email content
    const mailOptions = {
        from: 'mcswordyt@gmail.com',
        to: email,
        subject: 'Welcome to My Blog!',
        text: 'Thank you for registering on our blog. We hope you enjoy your stay!'
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}


// Assuming you have a Blog model defined, add a route to fetch and render blogs
app.get('/blogs', async (req, res) => {
    try {
        const blogs = await BlogPost.find().sort({ createdAt: -1 });
        res.render('blogs', { blogs });
    } catch (error) {
        res.status(500).send('Error fetching blogs');
    }
});

// Render admin page
app.get('/admin', async (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const blogPosts = await BlogPost.find()
        res.render('admin', {blogPosts});
    } else {
        res.status(403).send('Unauthorized access.');
    }
});

// Create a new blog post
app.post('/admin/blogs', async (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        try {
            const { title, content, images } = req.body;
            const newBlogPost = new BlogPost({
                title,
                content,
                images
            });
            await newBlogPost.save();
            res.status(201).send('Blog post created successfully.');
        } catch (error) {
            res.status(500).send('Error creating blog post.');
        }
    } else {
        res.status(403).send('Unauthorized access.');
    }
});

// Create a new item
app.post('/admin/addItem', async (req, res) => {
    const { title, content, titleRu, contentRu, images } = req.body;

    try {
        // Create new item in database with title, content, images, titleRu, and contentRu
        // Example:
        const newItem = new BlogPost({
            title,
            content,
            titleRu,
            contentRu,
            images: images.split(',').map(image => image.trim())
        });
        await newItem.save();
        res.status(201).send('Item created successfully.');
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).send('Error creating item.');
    }
});


// Update an existing item
// server.js

app.post('/admin/updateItem/:id', async (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
    const itemId = req.params.id;
    try {
        const { title, content, titleRu, contentRu} = req.body;
        const updatedItem = await BlogPost.findByIdAndUpdate(itemId, {
            title,
            content,
            titleRu,
            contentRu,
            updatedAt: Date.now()
        }, { new: true });
        res.status(200).send('Item updated successfully.');
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).send('Error updating item.');
    }}else {
        res.status(403).send('Unauthorized access.');
    }
});



// Delete an existing item
app.post('/admin/deleteItem/:id', async (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const itemId = req.params.id;
        try {
            await BlogPost.findByIdAndDelete(itemId);
            console.log('Item deleted with ID:', itemId);
            res.status(200).send('Item deleted successfully.');
        } catch (error) {
            console.error('Error deleting item:', error);
            res.status(500).send('Error deleting item.');
        }
    } else {
        res.status(403).send('Unauthorized access.');
    }
});

// Handle like action
app.post('/blogs/like/:id', async (req, res) => {
    const blogId = req.params.id;
    try {
        const blog = await BlogPost.findById(blogId);
        blog.likes += 1;
        await blog.save();
        res.status(200).send('Liked');
    } catch (error) {
        console.error('Error liking blog:', error);
        res.status(500).send('Error liking blog.');
    }
});

app.get('/news', async (req, res) => {
    try {
        const newsResponse = await axios.get(newsApiUrl, {
            params: {
                apiKey: newsApiKey,
                language: 'ru'
            },
        });

        const newsData = {
            articles: newsResponse.data.articles.slice(0, 5)
        };

        res.render('news', newsData);
    } catch (error) {
        console.error('Error fetching news data:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/exchange-rates', async (req, res) => {
    try {
        const exchangeRatesResponse = await axios.get(currencyExchangeApiUrl);

        const exchangeRatesData = {
            rates: exchangeRatesResponse.data.rates,
        };

        res.render('exchange-rates', exchangeRatesData); // Render the exchange-rates.ejs template and pass exchangeRatesData to it
    } catch (error) {
        console.error('Error fetching exchange rates data:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// server.js

app.get('/random-quote', async (req, res) => {
    try {
        const response = await axios.get('https://favqs.com/api/qotd');

        if (response.data && response.data.quote) {
            const randomQuote = response.data.quote;
            res.render('random-quote', { quote: randomQuote });
        } else {
            throw new Error('Unable to fetch quote');
        }
    } catch (error) {
        console.error('Error fetching random quote:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
