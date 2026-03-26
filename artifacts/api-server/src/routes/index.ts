import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shopifyRouter from "./shopify";
import pushRouter from "./push";
import eventsRouter from "./events";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/shopify", shopifyRouter);
router.use("/push", pushRouter);
router.use("/events", eventsRouter);

export default router;
