import Adapter from "./adapter.js";

export default class Onebot extends Adapter {
  constructor() {
    super();
  }

  convertMessage(data) {
    console.log(data);
    data.message.forEach((element, index) => {
      if (element.type === "image") {
        const base64Data = element.data.file.replace(
          /^base64:\/\//,
          "data:image/jpeg;base64,",
        );
        data.message[index].data.file = base64Data;
        console.log(data.message[index]);
      } else if (element.type === "nodes") {
        element.data.messages.forEach((node) => {
          if (node.type === "image") {
            const base64Data = node.data.file.replace(
              /^base64:\/\//,
              "data:image/jpeg;base64,",
            );
            node.data.file = base64Data;
          }
        });
      }
    });

    const rplMessage = data.message.filter(
      (element) => element.type === "reply",
    );
    const midMessage = data.message.filter(
      (element) => element.type !== "reply",
    );
    if (rplMessage.length > 0) {
      midMessage.push(rplMessage[0]);
    }

    const webMessage = {
      role: "other",
      time: new Date().getTime(),
      content: midMessage,
      id: data.message_id,
      status: "completed",
    };
    return webMessage;
  }

  /**
   * Send message to server
   * @param {id} string
   * @param {WebMessage} message
   * @returns {Promise<number>} message_id
   */
  async send(id, message) {
    const response = await this.fetch(
      "/api/onebot/message" + `/${id}`,
      message,
    );
    return response.message_id;
  }
}
