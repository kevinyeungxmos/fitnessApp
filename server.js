const express = require("express")
const path = require("path")
const exphbs = require("express-handlebars")
const cookieParser = require("cookie-parser")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const session = require("express-session")
const userRouter = require("./route/control.js")
const { checkLogin } = require("./middleware/auth.js")
const { users, roles, classes, carts, payments } = require("./models/dbSchema.js")
const app = express()

const HTTP_PORT = process.env.PORT || 8080

app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    helpers: {
        json: (context) => { return JSON.stringify(context) }
    }
}))

app.use(session({
    secret: "the quick brown fox jumped over the lazy dog 1234567890",  // random string, used for configuring the session
    resave: false,
    saveUninitialized: true
 })) 

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

//use db aggregation to calculate
async function CountAmount(email){
    const result = await carts.aggregate([{$match:{buyerm:email} },{$unwind:"$cart"},{$lookup:{
        from:"classes",
        localField: "cart.itemid",
        foreignField: "_id",
        as: "bookedClass"}},{$set:{"cart.itemid": "$bookedClass"}}, {$project:{cart:1, buyerm:1}}, {$unwind:"$cart.itemid"},
        {$group:{_id:"$buyerm", amount:{ $sum: {$multiply:["$cart.itemid.price", "$cart.itemid.duration"]}}, count:{$sum:1}}}])

    const subTotal = result[0].amount
    const tax = subTotal * 0.13
    const total = subTotal * 1.13
    const calc = {
                subTotal:subTotal.toFixed(2),
                buyer:result[0]._id,
                itemCount:result[0].count,
                tax:tax.toFixed(2),
                total: total.toFixed(2)}
    return calc

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
            var result = await CountAmount(req.email)
            for(const i of itemNum.cart){
                const itemPay = await classes.findById(i.itemid).lean()
                cartList.push({classname:itemPay.classname, instructor:itemPay.instructor, 
                                duration:itemPay.duration, cartNum:i._id.toHexString(), buyer: vip.email})
            }
            if(vip.monPass){
                result.subTotal = 0
                result.tax = 0
                result.total = 0
                res.render("cart", { layout: "skeleton", login: true, hasItem: true, cartItem: cartList,
                                 vip: vip.monPass, buyer: vip.email, calresult: result})
            }
            else{
                res.render("cart", { layout: "skeleton", login: true, hasItem: true, cartItem: cartList,
                                 vip: vip.monPass, buyer: vip.email, calresult: result})
            }
        }
        else{
            res.render("cart", { layout: "skeleton", login: true, hasItem: false, cartItem: cartList,
                                 vip: vip.monPass, buyer: vip.email, calresult: result})
        }
    }
    else {
        // res.render("message", { layout: "skeleton", login: false, msg:"Error", err:"Please Login to Process Payment"})
        res.render("cart", { layout: "skeleton", login: false, hasItem: false})
    }
})

app.get("/admin", checkLogin, async (req,res)=>{
    if(req.email){
        const admin = await users.findOne({email: req.email}).lean()
        if(admin.role !== "admin"){
            res.render("message", { layout: "skeleton", login: true, msg:"Error", err:"Authorization needed. Please login as admin user" })
        }
        else{
            const earning = await payments.aggregate([{$group: {_id: null, Amount: {$sum:"$total"}}}]) 
            var allReceipt = await payments.aggregate([{$match: {_id:{$exists:true}}}])
            var listOfReceipt = []
            for(const i of allReceipt){
                const cl = []
                for(const c of i.paidList){
                    cl.push(c.item)
                }
                listOfReceipt.push({
                    name:i.cxname,
                    email: i.cxm,
                    id: (i.cxid).toHexString(),
                    no: i.paymentNum,
                    date: i.date,
                    total: i.total,
                    class: cl
                })
            }
            res.render("admin", { layout: "skeleton", login: true, allList: listOfReceipt, earning: (earning[0].Amount.toFixed(2))})
            
        }
    }else{
        res.render("message", { layout: "skeleton", login: false, msg:"Error", err: "Authentication needed. Please login as admin user"})
    }
})

app.use("/user", userRouter)

const onHttpStart = () => {
    console.log(`Web server started on port ${HTTP_PORT}, press CTRL+C to exit`)
}


app.listen(HTTP_PORT, onHttpStart)
