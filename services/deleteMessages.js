async function deleteMessages(count, ctx) {
    let messageId = 0;
    for(let i = ctx.message.message_id; i >= ctx.message.message_id - count; i--){
      messageId = i;
      try {
        await ctx.deleteMessage(messageId);
      } catch(e) {
        new Error('Ошибка удаления сообщения');
      }

    }
  }


module.exports = {deleteMessages};