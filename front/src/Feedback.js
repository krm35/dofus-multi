import React, {useState} from "react";
import {Button, Dialog, EditableText, Icon} from "@blueprintjs/core";
import * as Classes from "@blueprintjs/core/lib/cjs/common/classes";

export default function ({feedback, setFeedback}) {

    const [likes, setLikes] = useState([false, false, false, false, false]);

    return (
        <Dialog
            icon="comment"
            title={"Feedback"}
            isOpen={feedback !== null}
            onClose={() => setFeedback(null)}
        >
            <div className={Classes.DIALOG_BODY}>
                <div style={{display: "flex", justifyContent: "center"}}>
                    {likes.map((value, i) => <><Icon
                        icon={value ? "star" : "star-empty"}
                        onClick={() => {
                            for (let y = 0; y <= i; y++) likes[y] = true;
                            for (let y = i + 1; y < 5; y++) likes[y] = false;
                            setLikes([...likes]);
                        }}
                    />&nbsp;&nbsp;&nbsp;</>)}
                </div>
                <br/>
                <EditableText
                    multiline={true}
                    minLines={3}
                    maxLines={12}
                    onChange={(e) => setFeedback(e)}
                />
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    <Button
                        outlined
                        style={{width: "100px"}}
                        intent="primary"
                        icon={"send-message"}
                        onClick={() => {
                            window.ws.send(JSON.stringify({
                                body: {feedback, likes},
                                action: "post",
                                resource: "feedback"
                            }));
                            setFeedback(null);
                        }}
                    />
                </div>
            </div>
        </Dialog>
    )
}