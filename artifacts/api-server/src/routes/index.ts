import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shopifyRouter from "./shopify";
import pushRouter from "./push";
import eventsRouter from "./events";
import bambuRouter from "./bambu";
import pihubRouter from "./pihub";
import cameraRouter from "./camera";
import discordRouter from "./discord";
import squareRouter from "./square";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/shopify", shopifyRouter);
router.use("/push", pushRouter);
router.use("/events", eventsRouter);
router.use("/bambu", bambuRouter);
router.use("/pihub", pihubRouter);
router.use("/camera", cameraRouter);
router.use("/discord", discordRouter);
router.use("/square", squareRouter);

export default router;
