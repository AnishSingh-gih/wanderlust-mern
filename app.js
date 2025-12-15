// =====================
// ENV CONFIG
// =====================
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

// =====================
// IMPORTS
// =====================
const express = require("express");
const app = express();

const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");

const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");

const passport = require("passport");
const LocalStrategy = require("passport-local");

const ExpressError = require("./utils/ExpressError");
const User = require("./models/user");
const { saveRedirectUrl } = require("./middleware");

// Routes
const listingRouter = require("./routes/listing");
const reviewRouter = require("./routes/review");
const userRouter = require("./routes/user");

// =====================
// ENV VARIABLES
// =====================
const PORT = process.env.PORT || 8080;
const DB_URL = process.env.ATLASDB_URL;

console.log("DB URL:", DB_URL);

// =====================
// DATABASE CONNECTION
// =====================
async function connectDB() {
    try {
        await mongoose.connect(DB_URL, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    }
}
connectDB();

// =====================
// APP CONFIG
// =====================
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// =====================
// SESSION STORE
// =====================
const store = MongoStore.create({
    mongoUrl: DB_URL,
    crypto: {
        secret: process.env.SECRET,
    },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("❌ MongoStore Error:", err);
});

app.use(
    session({
        store,
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        },
    })
);

app.use(flash());

// =====================
// PASSPORT CONFIG
// =====================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// =====================
// GLOBAL MIDDLEWARE
// =====================
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

// =====================
// ROUTES
// =====================
app.get("/", (req, res) => {
    res.redirect("/listings");
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use(saveRedirectUrl);
app.use("/", userRouter);

// =====================
// 404 HANDLER
// =====================
app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

// =====================
// ERROR HANDLER
// =====================
app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("error.ejs", { message });
});

// =====================
// SERVER
// =====================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
