const { Router } = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const alert = require("alert")
const { checkLogin } = require("../middleware/auth.js")
const { users, roles, classes, carts, payments } = require("../models/dbSchema.js")

const router = Router()

function valid(email) {
    const pattern = /^[^\s@]+@[^\.\s@]+\.[^\.\s@]+$/
    return email.match(pattern)
}

router.get("/", (req, res) => {
    res.render("login", { layout: "skeleton" })
})

router.post("/signup", async (req, res) => {
    try {
        if (!valid(req.body.email)) {
            res.render("message", { layout: "skeleton", err: "Invalid Email", msg: "Error", return: true })
            return
        }
        await users.findOne({ email: req.body.email }).lean().exec().then(async (result, err) => {
            if (!result) {
                if (req.body.password) {
                    //encrypt the password
                    req.body.password = bcrypt.hashSync(req.body.password, 10)
                    const token = jwt.sign({ email: req.body.email }, "SECRET", { expiresIn: 3600 });
                    let user_detail = {
                        password: req.body.password,
                        email: req.body.email,
                        role: "user",
                        token: token
                    }
                    req.session.userDetail = user_detail
                    res.render("mpass", { layout: "skeleton" })
                } else {
                    res.render("message", { layout: "skeleton", err: "Password is required", msg: "Error", return: true })
                }
            }
            else {
                res.render("message", { layout: "skeleton", err: "Eamil already exists", msg: "Error", return: true })
            }
        })
    } catch (error) {
        res.send(error)
    }

})

router.post("/login", async (req, res) => {
    try {
        if (!valid(req.body.email)) {
            res.render("message", { layout: "skeleton", err: "Invalid Email", msg: "Error", return: true })
            return
        }
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
                    res.redirect("/schedule")
                } else {
                    res.render("message", { layout: "skeleton", err: "Wrong Password", msg: "Error", return: true })
                }
            } else {
                res.render("message", { layout: "skeleton", err: "User doesn't exist", msg: "Error", return: true })
            }
        })
            .catch((err) => {
                res.json({ success: false, error: err })
            })
    } catch (error) {
        res.json({ error });
    }
})


router.post("/monps", async (req, res) => {
    try {
        const doc = await carts.create({})
        let new_user = await users.create({
            password: req.session.userDetail.password,
            email: req.session.userDetail.email,
            role: req.session.userDetail.role,
            token: req.session.userDetail.token,
            cartid: doc._id,
            monPass: true
        })
        doc.buyerid = new_user._id
        doc.buyerm = new_user.email
        await doc.save()
        res.cookie("token", new_user.token, {
            httpOnly: true,
        })
        //add 75$ to payments
        const paymentNum = (Math.random() * 100000000).toFixed(0)
        let a = await payments.create({
            cxm: req.session.userDetail.email,
            cxid: new_user._id,
            paidList: [{ item: "monthly plan" }],
            paymentNum: paymentNum,
            total: 84.75  //$75plus tax
        })
        res.redirect("/schedule")

    } catch (error) {
        console.log(error)
    }
})

router.post("/nomonpsignin", async (req, res) => {
    try {
        const doc = await carts.create({})
        let new_user = await users.create({
            password: req.session.userDetail.password,
            email: req.session.userDetail.email,
            role: req.session.userDetail.role,
            token: req.session.userDetail.token,
            cartid: doc._id,
            monPass: false
        })
        doc.buyerid = new_user._id
        doc.buyerm = new_user.email
        await doc.save()
        res.cookie("token", new_user.token, {
            httpOnly: true,
        })
        res.redirect("/schedule")
    } catch (error) {
        console.log(error)
    }
})

router.get("/logout", (req, res) => {
    res.clearCookie("token")
    req.session.destroy()
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
                            res.render("message", { layout: "skeleton", login: true, err: "class not found", msg: "Error", return: true })
                        }
                    })
                }
            })

        }
        else {
            //no one login do something
            res.render("message", { layout: "skeleton", login: false, err: "You need to login before booking classes.", msg: "Error", return: true })
        }
    } catch (error) {
        res.send(error)
    }
})

router.post("/payment", checkLogin, async (req, res) => {
    try {
        const total = parseFloat(req.body.total)
        if (req.email) {
            const user = await users.findOne({ email: req.email }).lean()
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
                res.render("message", { layout: "skeleton", login: true, msg: ` Payment Success! Confirmation Number: ${paymentNum}`, return: false })
            }
            else {
                res.render("message", { layout: "skeleton", login: true, msg: "Error", err: "No Item in Shopping Cart", return: true })
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
    if (req.email) {
        const admin = await users.findOne({ email: req.email }).lean()
        if (admin.role !== "admin") {
            res.render("message", { layout: "skeleton", login: true, msg: "Error", err: "Authorization needed. Please login as admin user", return: true })
        }
        else {
            const totalAmount = await payments.aggregate([{ $group: { _id: null, Amount: { $sum: "$total" } } }])
            const earning = totalAmount[0].Amount / 1.13
            const tax = earning * 0.13
            let sort = -1
            if (req.body.sort === "") {
                res.status(204).send()
                return
            }
            if (req.body.sort === "Ascending") {
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
            res.render("admin", { layout: "skeleton", login: true, allList: listOfReceipt, totalAmount: (totalAmount[0].Amount.toFixed(2)), 
                tax: tax.toFixed(2), earning: earning.toFixed(2) })
        }
    } else {
        res.render("message", { layout: "skeleton", login: false, msg: "Error", err: "Authentication needed. Please login as admin user", return: true })
    }
})

module.exports = router