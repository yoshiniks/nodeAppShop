const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const csrf = require('csurf');
const flash = require('connect-flash');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const multer = require('multer');

const errorController = require('./controllers/error');
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

const key = require('./key');

const User = require('./models/user');

const app = express();
const store = new MongoDBStore({
    uri: key.MONGODB_URI,
    collection: 'sessions'
});

const csrfProtection = csrf();

const fileStorage = multer.diskStorage({ 
    destination: (req, file, cb) => {
        cb(null, 'images');
    },
    filename: (req, file, cb) => {
        cb(null,  Math.random().toString() + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    if(file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
        cb(null, true);

    } else {
        cb(null, false);

    }
}

app.set('view engine', 'ejs');// seta o template engine como sendo ejs
app.set('views','views'); //mostra para o express aonde as views estao

//extract content of incoming request; 
app.use(bodyParser.urlencoded({ extended: false })); //urlencoded data is text data; 

app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'));


//middleware para conectar a pasta public
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use(session({ 
    secret: 'my secret', 
    resave: false, 
    saveUninitialized: false, 
    store: store 
}));
app.use(csrfProtection);
app.use(flash());

//para toda req executada, as views a serem renderizadas vao possuir os valores setados
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.session.isLoggedIn;
    res.locals.csrfToken = req.csrfToken();
    next();
});

app.use((req, res , next) => {
    if(!req.session.user) {
        return next();
    }
    User.findById(req.session.user._id)
    .then(user => {
        if(!user) {
            return next();
        }
        req.user = user;
        next();
    })
    .catch(err => {
        next(new Error(err));
    });
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get('/500', errorController.get500);

app.use(errorController.get404);

app.use((error, req, res, next) => {
    // res.status(error.httpStatusCode).render(...);
    // res.redirect('/500');
    res.status(500)
        .render('500', {
            pageTitle: 'Error!', 
            path: '/500',
            isAuthenticated: req.session.isLoggedIn
    });
});

mongoose
    .connect(key.MONGODB_URI)
    .then(result => {
        app.listen(3000);
    })
    .catch(err => {
        console.log(err);
});
