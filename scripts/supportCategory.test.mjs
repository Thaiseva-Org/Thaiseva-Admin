import test from "node:test";
import assert from "node:assert/strict";
import {messageCategory,currentChatCategory} from "../src/utils/supportCategory.js";

test("legacy and new category entries retain their labels without treating ordinary text as a category",()=>{
  assert.equal(messageCategory({legacyType:"heading",text:"Visa"}),"Visa");
  assert.equal(messageCategory({type:"heading",category:"Work Permit",text:"Work Permit"}),"Work Permit");
  assert.equal(messageCategory({text:"Visa"}),"");
  assert.equal(messageCategory({legacyType:"heading",text:"Visa",deleted:true}),"");
});
test("header uses latest category independently of loaded history and excludes other customers",()=>{
  const messages=[{customerId:"a",legacyType:"heading",text:"Visa",createdAt:1},{customerId:"b",legacyType:"heading",text:"Hotel",createdAt:3},{customerId:"a",type:"heading",category:"Work Permit",createdAt:2}];
  assert.equal(currentChatCategory({customerId:"a"},messages),"Work Permit");
  assert.equal(currentChatCategory({customerId:"a",currentCategory:"General"},messages),"General");
  assert.equal(currentChatCategory({customerId:"a",currentCategory:"Visa"},[]),"Visa");
});
