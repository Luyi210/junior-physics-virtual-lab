import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { Readable } from 'node:stream';
import { getHighSchoolExperiment } from '@physics-lab/knowledge/high-school';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { createApiHandler } from '../src/app.js';
import { openDatabase } from '../src/database.js';
import { createLiliService } from '../src/lili.js';
import { signAccessToken } from '../src/security.js';
import { isolatedSqliteConfig } from './helpers/isolated-config.js';

const ids = ['centripetal-force','precision-length','resistivity','multimeter','momentum-conservation','refractive-index','induced-current','transformer-ratio','sensor-control','oil-film','gas-pressure-volume','free-fall','photoelectric-effect','charged-particle-field'];
const parametersFor = (id) => ({ ...defaultHighSchoolParameters(id), ...(id === 'precision-length' ? { contactMode: 2, zeroCorrection: 1 } : {}) });
const lessonFor = (id) => ({ experimentId: id, title: `${id}合成课堂`, objective: '区分模型读数与实体实测', inquiryQuestion: '怎样保持控制条件？', predictionPrompt: '先预测', controlledVariable: '保留原始参数', evidenceRequirement: '明确选择模型读数文字副本', reflectionPrompt: '说明适用条件', durationMinutes: 40, status: 'ready' });
let db, config, services, handler, factoryCalls;
beforeEach(async () => {
  config = isolatedSqliteConfig({ tokenSecret: 'stage24-handler-test-only', liliRequestsPerMinute: 60 });
  db = await openDatabase(config); services = []; factoryCalls = 0;
  const service = createLiliService(config, { runtimeFactory: async () => { factoryCalls += 1; throw new Error('Unexpected paid runtime'); } });
  services.push(service); handler = createApiHandler({ db, config, lili: service });
});
afterEach(async () => { try { await Promise.all(services.map(s=>s.close())); } finally { await db?.close(); } });
async function request(path, { method='GET', body, user='student', using=handler }={}) {
  const identities = { student: ['user-student-1','student'], other: ['user-student-2','student'], teacher: ['user-teacher','teacher'] };
  const identity=identities[user];
  const token=identity ? signAccessToken({id:identity[0],role:identity[1],schoolId:'school-demo',name:'合成测试身份'},config) : null;
  const stream=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  Object.assign(stream,{method,url:`/api${path}`,headers:{host:'localhost','content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},socket:{remoteAddress:'stage24-test'}});
  let status,payload;await using(stream,{writeHead(value){status=value;},end(value){payload=value?JSON.parse(value):null;}});return {status,payload};
}

for (const id of ids) test(`${id}: real handler classroom/report/feedback and guided model context retain source conditions`,async()=>{
  assert.equal(getHighSchoolExperiment(id).status,'ready','Stage24 release must expose each expanded experiment');
  const lesson=await request('/lessons',{method:'POST',user:'teacher',body:lessonFor(id)});assert.equal(lesson.status,201);
  const task=await request('/tasks',{method:'POST',user:'teacher',body:{classId:'class-801',lessonId:lesson.payload.data.id,title:'阶段24任务',mode:'in-class',status:'published',allowRetry:false}});assert.equal(task.status,201);
  const started=await request('/sessions',{method:'POST',body:{taskId:task.payload.data.id}});assert.equal(started.status,201);assert.equal(started.payload.data.experimentId,id);
  const sessionId=started.payload.data.id,parameters=parametersFor(id), initial=simulateHighSchoolExperiment(id,parameters,0), timeSeconds=initial.durationSeconds/2;
  const snapshot=simulateHighSchoolExperiment(id,parameters,timeSeconds);
  const source={id:`original-${id}`,parameters:{...parameters},timeSeconds,metrics:snapshot.metrics};
  const measurements=`主动选入的原条件模型文字副本，不是实体实测或自动上传附件。\n${JSON.stringify(source)}`;
  const content={prediction:'先说明控制条件。',measurements,conclusion:'仅用本轮保存条件解释模型关系。',question:'这些简化在真实器材中有什么限制？'};
  const body={...content,expectedRevision:0,mutationId:`report-${id}`};
  const saved=await request(`/sessions/${sessionId}/record`,{method:'PUT',body});assert.equal(saved.status,200);assert.equal(saved.payload.data.record.measurements,measurements);
  assert.deepEqual((await request(`/sessions/${sessionId}/record`,{method:'PUT',body})).payload.data.record,saved.payload.data.record);
  const teacher=await request(`/tasks/${task.payload.data.id}/records`,{user:'teacher'});assert.deepEqual(teacher.payload.data[0].record,saved.payload.data.record);
  const feedback=await request(`/sessions/${sessionId}/feedback`,{method:'POST',user:'teacher',body:{body:'请说明这份模型读数的适用条件。',expectedRevision:1,mutationId:`feedback-${id}`}});assert.equal(feedback.status,201);assert.deepEqual(feedback.payload.data.reportSnapshot,content);
  const context={experimentId:id,parameters,timeSeconds,recordCount:1,samples:[{id:source.id,parameters,timeSeconds}]};
  const reply=await request('/lili/chat',{method:'POST',body:{conversationId:`expansion-${id}`,question:'解释当前状态和模型边界',context}});
  assert.equal(reply.status,200);assert.equal(reply.payload.data.mode,'guided');assert.ok(reply.payload.data.text.length>20);assert.equal(factoryCalls,0);
  assert.equal((await request(`/sessions/${sessionId}/record`,{user:'other'})).status,403);
  assert.equal((await request(`/sessions/${sessionId}/feedback`,{user:'other'})).status,403);
  assert.equal((await request(`/sessions/${sessionId}/complete`,{method:'PATCH'})).status,200);
  const blocked=await request(`/sessions/${sessionId}/record`,{method:'PUT',body:{...content,expectedRevision:1,mutationId:'after-complete'}});assert.equal(blocked.status,409);assert.equal(blocked.payload.error.code,'SESSION_COMPLETED');
  assert.equal((await request(`/sessions/${sessionId}/record`)).payload.data.record.measurements,measurements);
  assert.deepEqual((await request(`/sessions/${sessionId}/feedback`)).payload.data,[feedback.payload.data]);
});

test('all fourteen trusted references recompute model answers and never promote forged metrics into measurements',async()=>{
  const references=[];
  const service=createLiliService({...config,liliEnabled:true,deepseekApiKey:'synthetic-no-network-key'}, {runtimeFactory:async()=>({run:async(prompt)=>{references.push(JSON.parse(prompt.match(/<reference>(.*?)<\/reference>/s)[1]));return {finalResponse:'纯测试替身，无外部请求。'};},close:async()=>{}})});
  services.push(service);const using=createApiHandler({db,config,lili:service});
  for(const id of ids){
    const parameters=parametersFor(id),timeSeconds=simulateHighSchoolExperiment(id,parameters,0).durationSeconds/2;
    const context={experimentId:id,parameters,timeSeconds,recordCount:1,samples:[{id:`s-${id}`,parameters,timeSeconds,metrics:[{key:'forged',value:987654321}]}],snapshot:{state:{forged:987654321}},state:{forged:987654321},metrics:[{key:'forged',value:987654321}]};
    const before=structuredClone(context),expected=simulateHighSchoolExperiment(id,parameters,timeSeconds);
    const result=await request('/lili/chat',{method:'POST',using,body:{conversationId:'trusted-expansion',question:'分析当前条件',context}});
    assert.equal(result.status,200);assert.equal(result.payload.data.mode,'ai');const trusted=references.at(-1);
    assert.deepEqual(trusted.parameters,parameters);assert.deepEqual(trusted.modelSnapshot.state,expected.state);assert.deepEqual(trusted.modelSnapshot.metrics,expected.metrics);assert.equal(trusted.manualInstrumentReadings,null);assert.equal(trusted.savedSimulationAnalysis.includedCount,1);
    assert.doesNotMatch(JSON.stringify(trusted),/987654321/);assert.deepEqual(context,before);
  }
});

test('expanded context rejects unknown ids, malformed discrete settings/counts, and missing saved conditions',async()=>{
  const base={experimentId:'multimeter',parameters:parametersFor('multimeter'),timeSeconds:0,recordCount:0};
  const cases=[{...base,experimentId:'future-unpublished-experiment'}, {...base,parameters:{...base.parameters,functionMode:.5}},
    {experimentId:'oil-film',parameters:{...parametersFor('oil-film'),usedDrops:1.5},timeSeconds:0,recordCount:0},
    {...base,parameters:{...base.parameters,resistanceOhms:null}}, {...base,recordCount:1,samples:[{id:'partial',parameters:{functionMode:0},timeSeconds:0}]},
    {...base,manualRecordCount:1,manualSamples:[{id:'invented-meter',kind:'multimeter-manual',parameters:base.parameters,readings:{meterValue:6},timeSeconds:0}]}];
  for(const context of cases){const result=await request('/lili/chat',{method:'POST',body:{conversationId:'invalid-expansion',question:'解释读数',context}});assert.equal(result.status,422);assert.equal(result.payload.error.code,'VALIDATION_ERROR');}
  assert.equal((await request('/lili/chat',{method:'POST',user:'anonymous',body:{conversationId:'anonymous-expansion',question:'解释读数',context:base}})).status,401);
  assert.equal(factoryCalls,0);
});
