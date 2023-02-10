const express = require("express")
const path = require("path")
const exphbs = require("express-handlebars")
const cookieParser = require("cookie-parser")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const userRouter = require("./middleware/logControl.js")
const { checkLogin } = require("./middleware/auth.js")
const { users, roles, classes, carts, payments } = require("./models/dbSchema.js")
const app = express()

const HTTP_PORT = process.env.PORT || 8080

app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    helpers: {
        json: (context) => { return JSON.stringify(context) }
    }
}));

app.use(express.static(__dirname))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(express.static("assets"))
app.set("view engine", ".hbs")

//-----------------------------------------------------

const mongoose = require("mongoose")
mongoose.connect("mongodb+srv://ckyeung59:23258454Ha@cluster0.x983ogu.mongodb.net/myFirstDb")

//-----------------------------------------------------

//fetch all class from db
async function getClass(){
    var allClass = await classes.find({}).lean()
    var classList = []
    for(const c of allClass){
        const classInfo = { classname: c.classname, instructor: c.instructor, duration: c.duration, photo: c.photo } 
        classList.push(classInfo)
    }
    return classList
}

async function createAdmin(){
    const res = await users.findOne({ email: "247@247.com" })
    if (!res) {
        //create a empty doc for user
        const doc = await carts.create({})
        const pw = bcrypt.hashSync("admin", 10)
        const token = jwt.sign({ email: "247@247.com" }, "SECRET", { expiresIn: 3600 });
        let admin = await users.create({
            password: pw,
            email: "247@247.com",
            role: "admin",
            token: token,
            cartid: doc._id
        }).catch(err => {
            console.log(err)
        })
        doc.buyerid = admin._id
        doc.buyerm = admin.email
        await doc.save()
    }
}

//-----------------------------------------------------

app.get("/", checkLogin, (req, res) => {
    if (req.email) {
        res.render("home", { layout: "skeleton", login: true })
    }
    else {
        res.render("home", { layout: "skeleton", login: false })
    }
})

app.get("/schedule", checkLogin, async (req, res) => {
    const classList = await getClass()
    if (req.email) {
        res.render("schedule", { layout: "skeleton", listOfClass: classList, login: true })
    }
    else {
        res.render("schedule", { layout: "skeleton", listOfClass: classList, login: false })
    }
})

app.get("/cart", checkLogin, async (req, res) => {

    if (req.email) {
        const cartList = []
        const itemNum = await carts.findOne({buyerm: req.email}).lean()
        const vip = await users.findOne({email: req.email}).lean()
        if(itemNum.cart.length > 0){
            for(const i of itemNum.cart){
                const itemPay = await classes.findById(i.itemid).lean()
                cartList.push({classname:itemPay.classname, instructor:itemPay.instructor, 
                                duration:itemPay.duration, cartNum:i._id.toHexString(), buyer: vip.email})
            }
            res.render("cart", { layout: "skeleton", login: true, hasItem: true, cartItem: cartList, vip: vip.monPass})
        }
        else{
            res.render("cart", { layout: "skeleton", login: true, hasItem: false })
        }
    }
    else {
        res.render("cart", { layout: "skeleton", login: false })
    }
})

app.use("/user", userRouter)

const onHttpStart = () => {
    console.log(`Web server started on port ${HTTP_PORT}, press CTRL+C to exit`)
}


app.listen(HTTP_PORT, onHttpStart)
