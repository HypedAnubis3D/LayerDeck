import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shopifyRouter from "./shopify";
import etsyRouter from "./etsy";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/shopify", shopifyRouter);
router.use("/etsy", etsyRouter);

export default router;
