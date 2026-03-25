import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shopifyRouter from "./shopify";
import etsyRouter from "./etsy";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/shopify", shopifyRouter);
router.use("/etsy", etsyRouter);
router.use("/push", pushRouter);

export default router;
