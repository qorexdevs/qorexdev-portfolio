export function telegramReply(chatId, publicOrigin) {
  return {
    chat_id: chatId,
    text: 'Orderly - демонстрационный проект qorexdev. Соберите корзину и оформите тестовый заказ. Оплаты и доставки здесь нет.',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть Orderly', web_app: { url: `${publicOrigin}/demo/orderly` } }],
      ],
    },
  };
}
