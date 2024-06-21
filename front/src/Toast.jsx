import {Position, Toaster} from "@blueprintjs/core";

export default function Toast() {
    Toaster.create({
        className: "recipe-toaster",
        position: Position.TOP_RIGHT,
    });
}
