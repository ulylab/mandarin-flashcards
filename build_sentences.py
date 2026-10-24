"""Curated HSK1-focused sentence practice. Each line: source vocabulary pack | spaced Chinese lexical tokens | natural English meaning.
The tokenizer keeps each individual word's pinyin and meaning for reverse-side breakdowns.
"""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent

EASY = '''
foundation-01|杯子 在 桌子 上面 。|The cup is on the table.
foundation-01|椅子 在 门 后面 。|The chair is behind the door.
foundation-01|猫 在 盒子 里面 。|The cat is inside the box.
foundation-01|狗 在 桌子 下面 。|The dog is under the table.
foundation-02|我 有 一个 哥哥 。|I have an older brother.
foundation-02|妈妈 和 妹妹 在 家 。|Mom and my younger sister are at home.
foundation-02|姐姐 也 有 一个 弟弟 。|My older sister also has a younger brother.
foundation-02|爷爷 和 奶奶 在 家 。|Grandpa and Grandma are at home.
foundation-03|我 喜欢 喝 茶 。|I like drinking tea.
foundation-03|我们 在 厨房 吃 米饭 。|We eat rice in the kitchen.
foundation-03|筷子 和 勺子 在 桌子 上面 。|The chopsticks and spoon are on the table.
foundation-03|我 想 喝 水 。|I want to drink water.
foundation-04|明天 我 去 学校 。|I am going to school tomorrow.
foundation-04|昨天 他 在 医院 。|He was at the hospital yesterday.
foundation-04|谢谢 ， 再见 ！|Thank you, goodbye!
foundation-04|这 是 什么 ？|What is this?
foundation-05|你 是 老师 吗 ？|Are you a teacher?
foundation-05|这个 人 是 学生 。|This person is a student.
foundation-05|我们 看 书 。|We read books.
foundation-05|你们 说 中文 吗 ？|Do you speak Chinese?
foundation-06|我 想 买 一个 小 手机 。|I want to buy a small cellphone.
foundation-06|现在 很 热 。|It is very hot now.
foundation-06|下午 我 去 学校 。|I am going to school in the afternoon.
foundation-06|晚上 我 想 来 。|I want to come in the evening.
extended-hsk1-01|请问 ， 您 叫 什么 名字 ？|Excuse me, what is your name?
extended-hsk1-01|她们 认识 这个 同学 。|They know this classmate.
extended-hsk1-01|大家 很 高兴 。|Everyone is happy.
extended-hsk1-02|我 学 汉语 。|I study Mandarin Chinese.
extended-hsk1-02|今年 我 五 岁 。|I am five years old this year.
extended-hsk1-02|我们 都 有 两 个 朋友 。|We each have two friends.
extended-hsk1-03|这个 孩子 真 漂亮 。|This child is really pretty.
extended-hsk1-03|她 的 女儿 很 忙 。|Her daughter is very busy.
extended-hsk1-03|我 爱 我 的 女朋友 。|I love my girlfriend.
extended-hsk1-04|星期天 我 早上 起床 。|I get up in the morning on Sunday.
extended-hsk1-04|现在 三 点 半 。|It is half past three now.
extended-hsk1-05|午饭 我 吃 饺子 。|I eat dumplings for lunch.
extended-hsk1-05|早饭 我 喝 牛奶 。|I drink milk for breakfast.
extended-hsk1-06|我 要 买 苹果 。|I want to buy apples.
extended-hsk1-06|这个 面包 很 便宜 。|This bread is cheap.
extended-hsk1-07|商店 卖 衣服 。|The shop sells clothes.
'''
MEDIUM = '''
extended-hsk1-08|我 的 房间 在 这里 ， 他 的 房间 在 那里 。|My room is here, and his room is there.
extended-hsk1-08|我 住 在 这里 ， 每天 去 学校 。|I live here and go to school every day.
extended-hsk1-08|公司 在 电影院 前面 ， 我 知道 怎么 去 。|The company is in front of the cinema, and I know how to get there.
extended-hsk1-08|她 在 房间 里 找 手机 。|She is looking for her cellphone in the room.
extended-hsk1-09|今天 天气 怎么样 ？ 会 下雨 吗 ？|How is the weather today? Will it rain?
extended-hsk1-09|我 知道 怎么 坐 火车 去 中国 。|I know how to take a train to China.
extended-hsk1-09|老师 问 我 这个 汉字 怎么 读 。|The teacher asks me how to read this Chinese character.
extended-hsk1-09|他 会 开车 ， 但是 今天 坐 出租车 。|He can drive, but today he is taking a taxi.
extended-hsk1-10|这个 大学生 正在 读书 ， 不 想 看 电视 。|This university student is studying and doesn't want to watch TV.
extended-hsk1-10|医生 下班 以后 给 妈妈 打电话 。|After work, the doctor calls Mom.
extended-hsk1-10|我们 上课 的 时候 不 说话 。|We don't talk during class.
extended-hsk1-10|我 有 一个 问题 ， 上课 的 时候 可以 问 老师 吗 ？|I have a question. May I ask the teacher during class?
extended-hsk1-11|她 正在 唱歌 ， 我 觉得 很 好听 。|She is singing, and I think it sounds lovely.
extended-hsk1-11|我 生病 了 ， 今天 要 去 医院 看病 。|I'm sick, so I need to see a doctor at the hospital today.
extended-hsk1-11|你 看见 他 了 吗 ？ 我 听见 他 说话 了 。|Have you seen him? I heard him talking.
extended-hsk1-11|这个 电影 很 好看 ， 那个 歌 也 好听 。|This movie is good, and that song sounds good too.
foundation-01|猫 在 门 前面 ， 狗 在 门 后面 。|The cat is in front of the door, and the dog is behind it.
foundation-01|杯子 在 桌子 上面 ， 本子 在 盒子 里面 。|The cup is on the table, and the notebook is in the box.
foundation-02|我 的 姐姐 有 一个 儿子 ， 我 的 妹妹 有 一个 女儿 。|My older sister has a son, and my younger sister has a daughter.
foundation-02|哥哥 和 弟弟 都 在 学校 学习 。|My older and younger brothers are both studying at school.
foundation-03|我们 在 厨房 做饭 ， 妈妈 喜欢 吃 米饭 。|We are cooking in the kitchen, and Mom likes rice.
foundation-03|我 想 用 筷子 吃 饭 ， 也 想 喝 茶 。|I want to use chopsticks to eat and also drink tea.
foundation-04|昨天 我 没 工作 ， 今天 我 也 不 工作 。|I didn't work yesterday, and I'm not working today either.
foundation-04|请问 ， 医院 在 哪儿 ？|Excuse me, where is the hospital?
foundation-05|这个 老师 会 说 中文 ， 也 会 写 汉字 。|This teacher can speak Chinese and write Chinese characters.
foundation-05|我 的 朋友 喜欢 看 书 ， 也 喜欢 听 歌 。|My friend likes reading books and listening to songs.
foundation-06|上午 我 去 买 书 ， 下午 我 想 在 家 看 书 。|I am going to buy books in the morning and want to read at home in the afternoon.
foundation-06|今天 很 热 ， 我 想 喝 一点儿 冷 水 。|It's very hot today, and I want to drink a little cold water.
extended-hsk1-01|这个 先生 叫 什么 名字 ？ 我 认识 他 。|What is this man's name? I know him.
extended-hsk1-01|大家 都 是 同学 ， 认识 你 很 高兴 。|We're all classmates. Nice to meet you.
extended-hsk1-02|我们 家 有 四 口 人 ， 今年 都 很 忙 。|There are four people in our family, and everyone is busy this year.
extended-hsk1-02|我 和 两 个 朋友 都 在 学 汉语 。|Two friends and I are all studying Mandarin Chinese.
extended-hsk1-03|我 的 儿子 今年 六 岁 ， 女儿 今年 四 岁 。|My son is six this year, and my daughter is four.
extended-hsk1-03|她 的 男朋友 很 忙 ， 但是 他 非常 爱 她 。|Her boyfriend is busy, but he loves her very much.
extended-hsk1-04|我 早上 七 点 起床 ， 晚上 十 点 睡觉 。|I get up at seven in the morning and go to bed at ten at night.
extended-hsk1-04|星期天 我 有 时间 ， 可以 和 你 去 看 电影 。|I'm free on Sunday and can go to a movie with you.
extended-hsk1-05|午饭 我 想 吃 面条儿 ， 晚饭 想 吃 饺子 。|I want noodles for lunch and dumplings for dinner.
extended-hsk1-05|我 觉得 这个 包子 很 好吃 ， 再 吃 一个 吧 。|I think this steamed bun is delicious. Let's have another one.
extended-hsk1-06|这些 苹果 多少 钱 ？ 我 想 买 一些 。|How much are these apples? I'd like to buy some.
extended-hsk1-07|商店 里 有 很 多 新 衣服 ， 但是 有点儿 贵 。|There are lots of new clothes in the store, but they're a little expensive.
'''
HARD = '''
foundation-01|我 的 猫 在 桌子 下面 睡觉 ， 狗 在 门 前面 ， 但是 我 的 杯子 不 在 桌子 上面 。|My cat is sleeping under the table, the dog is in front of the door, but my cup isn't on the table.
foundation-02|我 的 妈妈 有 一个 哥哥 和 一个 妹妹 ， 哥哥 是 我 的 舅舅 ， 妹妹 是 我 的 阿姨 。|My mother has an older brother and a younger sister; her brother is my uncle and her sister is my aunt.
foundation-03|我 和 妈妈 在 厨房 做饭 的 时候 ， 弟弟 在 桌子 旁边 喝 水 ， 妹妹 在 吃 米饭 。|While Mom and I are cooking in the kitchen, my younger brother is drinking water next to the table and my younger sister is eating rice.
foundation-04|昨天 我 在 家 工作 ， 今天 我 要 去 学校 ， 明天 我 想 去 医院 看 朋友 。|Yesterday I worked at home, today I need to go to school, and tomorrow I want to visit a friend at the hospital.
foundation-05|我 的 朋友 是 中文 老师 ， 他 会 说 汉语 ， 也 会 写 汉字 ， 但是 他 不 会 开车 。|My friend is a Chinese teacher. He can speak Mandarin and write Chinese characters, but he can't drive.
foundation-06|今天 上午 很 冷 ， 下午 有点儿 热 ， 所以 我 想 晚上 再 去 买 东西 。|It was very cold this morning and a little hot in the afternoon, so I want to go shopping tonight instead.
extended-hsk1-01|请问 ， 您 认识 那个 中国 女士 吗 ？ 我们 都 是 她 的 同学 ， 但是 不 知道 她 的 名字 。|Excuse me, do you know that Chinese woman? We are all her classmates, but we don't know her name.
extended-hsk1-02|我们 家 有 五 口 人 ， 我 和 两 个 孩子 都 学 汉语 ， 但是 爸爸 和 妈妈 只 会 说 一点儿 。|There are five people in our family. The two children and I all study Mandarin, but Dad and Mom can only speak a little.
extended-hsk1-03|我 的 女儿 今年 七 岁 ， 她 非常 喜欢 学 汉语 ， 也 喜欢 和 小朋友 一起 玩 。|My daughter is seven this year. She really likes studying Mandarin and playing with other children.
extended-hsk1-04|明天 星期天 ， 我 想 早上 八 点 起床 ， 学 两 个 小时 汉语 ， 下午 和 朋友 看 电影 。|Tomorrow is Sunday. I want to get up at eight, study Mandarin for two hours, then see a movie with friends in the afternoon.
extended-hsk1-05|我 早上 没 吃 早饭 ， 中午 吃 了 一些 面条儿 ， 晚上 想 和 家人 一起 吃 饺子 。|I didn't eat breakfast, had some noodles at noon, and want to eat dumplings with my family tonight.
extended-hsk1-06|我 觉得 这 家 饭店 的 菜 很 好吃 ， 但是 有点儿 贵 ， 所以 今天 我 只 买 面包 和 水果 。|I think this restaurant's food is delicious but a little expensive, so today I'm only buying bread and fruit.
extended-hsk1-07|我 昨天 在 书店 买 了 两 本 书 ， 今天 又 去 超市 买 一些 东西 ， 但是 没 买 衣服 。|Yesterday I bought two books at the bookstore. Today I went to the supermarket to buy some things, but didn't buy clothes.
extended-hsk1-08|我 的 公司 在 电影院 前面 ， 医院 在 公司 后面 ， 我 的 家 在 这 两 个 地方 中间 。|My company is in front of the cinema, the hospital is behind the company, and my home is between those two places.
extended-hsk1-09|今天 天气 不 好 ， 早上 下雨 ， 下午 又 下雪 ， 所以 我 没 开车 ， 而是 坐 了 火车 。|The weather is bad today: it rained in the morning and snowed in the afternoon, so I took the train instead of driving.
extended-hsk1-10|我们 上课 的 时候 要 听 老师 说话 ， 下课 以后 可以 给 朋友 打电话 ， 但是 不要 在 课 上 看 电视 。|During class we need to listen to the teacher. After class we can call friends, but we shouldn't watch TV in class.
extended-hsk1-11|我 昨天 生病 了 ， 今天 去 医院 看病 ， 医生 说 我 要 多 休息 ， 不要 去 上班 。|I got sick yesterday and went to the hospital today. The doctor said I need more rest and shouldn't go to work.
extended-hsk1-01|这个 先生 是 我 的 同学 ， 我们 认识 三 年 了 ， 但是 我 还 不 知道 他 的 中文 名字 。|This man is my classmate. We've known each other for three years, but I still don't know his Chinese name.
extended-hsk1-05|妈妈 正在 厨房 做饭 ， 爸爸 在 看 电视 ， 我 想 和 妹妹 一起 吃 晚饭 ， 然后 去 睡觉 。|Mom is cooking in the kitchen, Dad is watching TV, and I want to have dinner with my younger sister and then go to sleep.
extended-hsk1-08|请问 ， 这边 有 医院 吗 ？ 我 的 朋友 生病 了 ， 我们 想 找 一个 离 这里 很 近 的 医生 。|Excuse me, is there a hospital near here? My friend is sick, and we want to find a doctor close by.
'''

# The sentence pool deliberately stays HSK1-heavy even on hard cards.
# Uncommon connectors and constructions get beginner-friendly inline glosses.
OVERRIDES = {
'，': ('', ''),'。': ('',''),'？': ('',''),'！': ('',''),
'这个': ('zhège','this'), '那个': ('nàge','that'), '一个': ('yí ge','one (measure phrase)'),
'一': ('yī','one'), '一 个': ('yí ge','one (measure phrase)'),
'两': ('liǎng','two'), '了': ('le','completed action / change'),
'只': ('zhǐ','only'), '只 会': ('zhǐ huì','can only'),
'很': ('hěn','very / degree marker'), '都': ('dōu','all'), '也': ('yě','also'),
'不': ('bù','not'), '没': ('méi','did not / not have'),
'在': ('zài','at / in; ongoing action'), '的': ('de','possessive / modifier particle'),
'以后': ('yǐhòu','after'), '下雪': ('xiàxuě','snow (verb)'), '地方': ('dìfang','place'), '每天': ('měitiān','every day'), '但是': ('dànshì','but'),
'因为': ('yīnwèi','because'), '所以': ('suǒyǐ','so / therefore'),
'正在': ('zhèngzài','currently (action in progress)'),
'唱歌': ('chànggē','singing'), '用': ('yòng','use'), '以后': ('yǐhòu','after'),
'以后': ('yǐhòu','after'), '一点儿': ('yìdiǎnr','a little'),
'四': ('sì','four'), '五': ('wǔ','five'),
'然后': ('ránhòu','then / afterward'), '又': ('yòu','again (completed)'),
'离': ('lí','away from / distance from'), '近': ('jìn','near / close'),
'而是': ('érshì','but rather'), '时候': ('shíhou','time / when'),
'上': ('shàng','on / during'), '下': ('xià','under / after'),
'会': ('huì','can / will'), '要': ('yào','need / want'),
'一杯': ('yì bēi','one cup of'), '一本': ('yì běn','one (book)'),
'年': ('nián','year'), '个': ('ge','general measure word'),
'买': ('mǎi','buy'), '话': ('huà','speech'),
'妈妈': ('māma','mom'), '爸爸': ('bàba','dad'),
'她': ('tā','she'), '他': ('tā','he'), '这': ('zhè','this'),
'那': ('nà','that'), '一起': ('yìqǐ','together'),
'啊': ('a','exclamation'), '？': ('',''),
'想': ('xiǎng','want to / think'), '和': ('hé','and / with'),
'看': ('kàn','watch / look at'), '喜欢': ('xǐhuan','like'),
'只': ('zhǐ','only'),
}

vocab={}
for packpath in (ROOT/'data/packs').glob('*.json'):
    d=json.loads(packpath.read_text(encoding='utf-8'))
    for c in d['cards']:
        vocab.setdefault(c['zh'],(c['py'],c['en']))
vocab.update(OVERRIDES)
# Fix overly terse glosses for individual word-by-word cards where helpful.
GLOSSES = {'饭':'meal/rice','一':'one','这':'this','那':'that','些':'some', '么':'question suffix','吧':'suggestion particle',
'吗':'yes/no question particle','呢':'follow-up question particle', '在':'at / in; ongoing action',
'上':'on / during','下':'under / after','课':'class','饭店':'restaurant', '读':'read',
'汉语':'Mandarin Chinese','中文':'Chinese language','汉字':'Chinese character',
'问':'ask','给':'give / to','号':'day of month', '时间':'time',
'有':'have / there is','着':'ongoing action', '请问':'excuse me / may I ask',
'本':'measure word for books', '口':'measure word for family members',
'只':'only','可以':'may / can','得':'degree particle', '再':'again / later',
'还':'still / also', '来':'come', '看病':'see a doctor','打电话':'make a phone call',
'非常':'extremely','觉得':'think / feel', '对面':'opposite',
'学':'learn', '学习':'study', '睡觉':'sleep',
'做饭':'cook','米饭':'cooked rice', '吃':'eat','喝':'drink',
'回':'return', '买':'buy', '到':'arrive at', '看见':'see',
'那儿':'there', '这儿':'here', '这里':'here', '那里':'there',
'没有':'do not have / there is not', '不':'not', '没':'not / did not',
'多少':'how many / how much',
}

def lines(raw, difficulty):
    out=[]
    for line in raw.strip().splitlines():
        if not line.strip():continue
        parts=line.strip().split('|')
        if len(parts)!=3: raise ValueError(line)
        pack, tokens, translation = parts
        pieces=tokens.split()
        if pieces[-1] not in ('。','？','！'):raise ValueError(f'Missing terminal punctuation: {line}')
        if any(t not in vocab for t in pieces):
            missing=[t for t in pieces if t not in vocab]
            raise ValueError(f'Unknown words {missing}: {line}')
        zh=''.join(pieces)
        py=[]; breakdown=[]
        for tok in pieces:
            if tok in '，。？！':
                if py: py[-1] += tok.translate(str.maketrans({'，':',','。':'.','？':'?','！':'!'}))
                continue
            p,gloss=vocab[tok]
            if not p:raise ValueError(tok)
            breakdown.append({'zh':tok,'py':p,'en':GLOSSES.get(tok,gloss)})
            py.append(p)
        text=' '.join(py)
        text=text[0].upper()+text[1:]
        out.append({'id':f"sentence-{difficulty}-{len(out)+1:03d}", 'type':'sentence','difficulty':difficulty,
            'sourcePack':pack,'topic':'Sentence practice', 'zh':zh,'py':text,'en':translation,
            'breakdown':breakdown})
    return out

all_data={'easy':lines(EASY,'easy'),'medium':lines(MEDIUM,'medium'),'hard':lines(HARD,'hard')}
for diff,num in [('easy',40),('medium',40),('hard',20)]:
    items=all_data[diff]
    if len(items)!=num:raise AssertionError((diff,len(items),num))
    # Independent packs of ten keep payloads small and enable incremental updates.
    step = 5 if diff == 'hard' else 10
    for batch in range(0,num,step):
        pack_id=f'sentences-{diff}-{batch//step+1:02d}'
        output={'id':pack_id, 'label':f'HSK 1 sentences · {diff} · pack {batch//step+1}',
            'type':'sentence', 'cards':items[batch:batch+step]}
        out=ROOT/'data/packs'/f'{pack_id}.json'
        out.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(pack_id,len(output['cards']),out)
