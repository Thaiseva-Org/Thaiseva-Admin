const {test}=require('node:test');const assert=require('node:assert/strict');
const {chatMediaPath,canAccessChat}=require('../lib/chatMedia');
test('private chat paths reject bearer links, traversal and other buckets',()=>{
 const path='private-chat/chats/user_CustomerSupport/user/12345678-1234-1234-1234-123456789abc';
 assert.equal(chatMediaPath(path)[1],'user_CustomerSupport');
 for(const value of ['https://example.com/file','chat/user/old',path+'/extra',path.replace('/user/','/../'),null])assert.equal(chatMediaPath(value),null);
});
test('support attachments belong only to that user or protected administrators',()=>{
 assert.equal(canAccessChat('user',{},'Customer','chats','user_CustomerSupport',{}),true);
 assert.equal(canAccessChat('other',{},'Customer','chats','user_CustomerSupport',{participants:['other']}),false);
 assert.equal(canAccessChat('admin',{admin:true},'','chats','user_CustomerSupport',{}),true);
 assert.equal(canAccessChat('staff',{foodMasterAdmin:true},'','chats','user_CustomerSupport',{}),true);
 assert.equal(canAccessChat('other',{email:'admin@gmail.com'},'Sub Admin','chats','user_CustomerSupport',{}),false);
});
test('general and food chat authorization requires actual membership and scope',()=>{
 assert.equal(canAccessChat('receiver',{},'Customer','chats','thread',{participants:['sender','receiver']}),true);
 assert.equal(canAccessChat('other',{},'Customer','chats','thread',{participants:['sender','receiver']}),false);
 assert.equal(canAccessChat('user',{},'Customer','foodCustomerSupportChats','user',{customerId:'user'}),true);
 assert.equal(canAccessChat('user',{},'Customer','foodCustomerSupportChats','someone',{customerId:'user'}),false);
 assert.equal(canAccessChat('user',{admin:true},'Admin','users','user',{}),false);
});
