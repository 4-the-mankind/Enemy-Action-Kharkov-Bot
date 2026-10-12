// Names of game things as messages (task 5.4): the engine passes them as parameters.
import { dynamicKey, msg, type Message } from "../i18n/message";

export const armyName = (token: string): Message => msg(dynamicKey(`names.army.${token}`));
export const frontName = (front: string): Message => msg(dynamicKey(`names.front.${front}`));
export const sideName = (side: string): Message => msg(dynamicKey(`names.side.${side}`));
export const adjustmentName = (id: string): Message => msg(dynamicKey(`names.adjustment.${id}`));
