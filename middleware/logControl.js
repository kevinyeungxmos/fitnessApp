const { Router } = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const alert = require("alert")
const { checkLogin } = require("./auth.js")
const { users, roles, classes, carts, payments } = require("../models/dbSchema.js")

const router = Router()

router.get("/", (req, res) => {
    res.render("login", { layout: "skeleton" })
})

router.post("/signup", async (req, res) => {
    try {
        await users.findOne({ email: req.body.email }).lean().exec().then(async (result, err) => {
            if (!result) {
                if (req.body.password) {
                    //create a empty doc for user
                    const doc = await carts.create({})
                    req.body.password = bcrypt.hashSync(req.body.password, 10)
                    const token = jwt.sign({ email: req.body.email }, "SECRET", { expiresIn: 3600 });
                    let new_user = await users.create({
                        password: req.body.password,
                        email: req.body.email,
                        role: "user",
                        token: token,
                        cartid: doc._id
                    }).catch(err => {
                        console.log(err.errors.email.properties.message)
                        const errMsg = err.errors.email.properties.message
                        // res.send(errMsg)
                        res.render("error", { layout: "skeleton", err: errMsg })
                    })
                    doc.buyerid = new_user._id
                    doc.buyerm = new_user.email
                    await doc.save()
                    res.cookie("token", token, {
                        httpOnly: true,
                    })
                    res.render("mpass", { layout: "skeleton", data: "successfully login" })
                } else {
                    res.render("errornopassword", { layout: "skeleton", err: "password is required" })
                }
            }
            else {
                res.render("erroraccexist", { layout: "skeleton", err: "email exist" })
            }
        })
    } catch (error) {
        res.send(error)
    }

})

router.post("/login", async (req, res) => {
    try {
        // check if the user exists
        await users.findOne({ email: req.body.email }).lean().exec().then(async (result, err) => {
            if (result) {
                //check if password matches
                const respw = bcrypt.compareSync(req.body.password, result.password);
                if (respw) {
                    // sign token and send it in response
                    const token = jwt.sign({ email: result.email }, "SECRET", { expiresIn: 3600 });
                    result.token = token
                    await users.updateOne({ _id: result._id }, { $set: { token: token } }).lean().exec()
                    res.cookie("token", token, {
                        httpOnly: true,
                    })
                    res.status(301).redirect("/schedule")
                } else {
                    res.send("wrong pw")
                }
            } else {
                res.send("User doesn't exist");
            }
        })
            .catch((err) => {
                res.json({ success: false, error: err })
            })
    } catch (error) {
        res.json({ error });
    }
})


router.post("/monps", checkLogin, async (req, res) => {
    try {
        if (req.email) {
            await users.findOne({ email: req.email }).lean().exec().then(async (result, err) => {
                if (result) {
                    //update user monthly plan to true
                    await users.updateOne({ email: req.email }, { $set: { monPass: true } }).lean().exec()
                    //add 75$ to payments
                    const paymentNum = (Math.random() * 100000000).toFixed(0)
                    let a = await payments.create({
                        cxm: req.email,
                        cxid: result._id,
                        paidList: [{ item: "monthly plan" }],
                        paymentNum: paymentNum,
                        total: 75
                    })
                    res.status(301).redirect("/schedule")
                }
            })
        }
        else {
            res.send("error");
        }
    } catch (error) {
        res.send(error)
    }
})

router.get("/logout", (req, res) => {
    res.clearCookie("token")
    alert("Logout Sucessfully!")
    res.status(301).redirect("/")
})

router.post("/toCart", checkLogin, async (req, res) => {
    try {
        if (req.email) {
            //user logined do something
            let clm = Object.keys(req.body)
            await users.findOne({ email: req.email }).lean().exec().then(async (user, err) => {
                if (user) {
                    await classes.findOne({ classname: clm }).lean().exec().then(async (cl, er) => {
                        const update = { item: cl.classname, itemid: cl._id }
                        if (cl) {
                            await carts.updateOne({ _id: user.cartid }, { $push: { cart: update } }).lean().exec()
                            alert(`Added ${cl.classname} to the cart`)
                            res.redirect("/schedule")
                        }
                        else {
                            res.send("Error: class not found")
                        }
                    })
                } else {
                    res.send("Error: user not found")
                }
            })

        }
        else {
            //no one login do something
            // res.send("Please Login To Book the Course")
            res.render("bookbutlogout", { layout: "skeleton" })
        }
    } catch (error) {
        res.send(error)
    }
})

router.post("/payment", checkLogin, async (req, res) => {
    try {
        // console.log(req.body)
        const total = parseFloat(req.body.total)
        if (req.email) {
            const user = await users.findOne({ email: req.email }).lean()
            // console.log(user)
            const ct = await carts.findOne({ buyerid: user._id })
            if (ct.cart.length > 0) {
                const paymentNum = (Math.random() * 100000000).toFixed(0)
                cartItem = []
                for (const i of ct.cart) {
                    cartItem.push({ item: i.item, itemid: i.itemid })
                }
                const update = {
                    cxname: req.body.cxname,
                    cxm: user.email,
                    cxid: user._id,
                    paymentNum: paymentNum,
                    paidList: cartItem,
                    total: total
                }
                //add payment to db
                await payments.create(update)
                // clear shopping cart
                ct.cart = []
                await ct.save()
                res.render("message", { layout: "skeleton", login: true, msg: ` Payment Success! Confirmation Number: ${paymentNum}` })
            }
            else {
                res.render("message", { layout: "skeleton", login: true, msg: "Error: No Item in Shopping Cart" })
            }

        }
    } catch (error) {
        res.send(error)
    }
})

router.post("/remove", async (req, res) => {
    const bKey = Object.keys(req.body)
    const stringToId = new mongoose.mongo.ObjectId.createFromHexString(req.body[bKey])
    const cartOwner = await carts.findOneAndUpdate({ buyerm: bKey },
        { $pull: { cart: { _id: stringToId } } },
        { new: true }).lean()
    res.redirect("/cart")
})

router.post("/sorting", checkLogin, async (req, res) => {
    console.log(req.body)
    if (req.email) {
        const admin = await users.findOne({ email: req.email }).lean()
        if (admin.role !== "admin") {
            res.render("message", { layout: "skeleton", login: true, msg: "Error: Authorization needed. Please login as admin user" })
        }
        else {
            const earning = await payments.aggregate([{ $group: { _id: null, Amount: { $sum: "$total" } } }])
            var sort = -1
            if (req.body.sort === "Ascending"){
                sort = 1
            }
            var allReceipt = await payments.aggregate([{ $match: { _id: { $exists: true } } }, { $sort: { cxm: sort } }])
            var listOfReceipt = []
            for (const i of allReceipt) {
                const cl = []
                for (const c of i.paidList) {
                    cl.push(c.item)
                }
                listOfReceipt.push({
                    name: i.cxname,
                    email: i.cxm,
                    id: (i.cxid).toHexString(),
                    no: i.paymentNum,
                    date: i.date,
                    total: i.total,
                    class: cl
                })
            }
            console.log("you login successfully")
            res.render("admin", { layout: "skeleton", login: true, allList: listOfReceipt, earning: earning[0].Amount })

        }
    } else {
        res.render("message", { layout: "skeleton", login: false, msg: "Error: Authentication needed. Please login as admin user" })
    }
})

module.exports = router