/**
 * Zerph — Russian Name Clusters
 * Каждый массив = одна личность (все формы одного имени).
 * Используется для умного поиска человека по ласкательным и уменьшительным именам.
 */

// Каждый внутренний массив — это «кластер» одного имени:
// официальное + все уменьшительные + транслитерация + английский
export const NAME_CLUSTERS: string[][] = [

  // ═══════════════ МУЖСКИЕ ИМЕНА ═══════════════

  ['александр', 'саша', 'саня', 'шура', 'шурик', 'сашка', 'сашок', 'алекс', 'alex', 'sasha', 'alexander', 'aleksander'],
  ['алексей', 'лёша', 'леша', 'лёха', 'леха', 'алик', 'алёша', 'алёха', 'lesha', 'lyosha', 'alexey', 'aleksei'],
  ['андрей', 'андрюша', 'андрюха', 'дрюша', 'дрюха', 'andrey', 'andrei', 'andrew', 'andre'],
  ['антон', 'тоша', 'тошик', 'тошка', 'антошка', 'anton'],
  ['аркадий', 'аркаша', 'аркашка', 'аркаха', 'arkady', 'arkadiy', 'arkadi'],
  ['артём', 'артем', 'тёма', 'тема', 'тёмка', 'тёмыч', 'темка', 'artem', 'artyom', 'tyoma'],
  ['борис', 'боря', 'борька', 'борис', 'борисик', 'boris'],
  ['вадим', 'вадик', 'вадя', 'vadim', 'vadik'],
  ['валентин', 'валя', 'валик', 'валентинчик', 'valentin', 'valya'],
  ['валерий', 'валера', 'валерка', 'лера', 'valery', 'valeri', 'lera'],
  ['василий', 'вася', 'васька', 'васёк', 'vasya', 'vasily', 'vasili'],
  ['виктор', 'витя', 'витёк', 'витька', 'виктоша', 'viktor', 'victor', 'vitya'],
  ['виталий', 'виталик', 'виталя', 'vitaly', 'vitali', 'vitaliy'],
  ['владимир', 'вова', 'вовка', 'вован', 'вовчик', 'вовик', 'vladik', 'vladimir', 'vova', 'volodya', 'volodja', 'vovka'],
  ['владислав', 'влад', 'владик', 'vladislav', 'vlad'],
  ['геннадий', 'гена', 'генка', 'геша', 'gena', 'genka', 'gennady', 'gennadiy'],
  ['георгий', 'гоша', 'жора', 'горя', 'georgiy', 'georgii', 'george', 'gosha', 'zhora'],
  ['глеб', 'gleb'],
  ['григорий', 'гриша', 'гришка', 'гришаня', 'grigory', 'grigoriy', 'grisha'],
  ['даниил', 'данила', 'даня', 'данька', 'данечка', 'daniil', 'danil', 'danila', 'daniel', 'danya'],
  ['денис', 'дениска', 'денька', 'denis', 'deniska'],
  ['дмитрий', 'дима', 'митя', 'димон', 'димка', 'митька', 'dmitry', 'dmitri', 'dima', 'mitya'],
  ['евгений', 'женя', 'женька', 'жека', 'evgeny', 'evgeniy', 'eugene', 'zhenya', 'zheka'],
  ['иван', 'ваня', 'ванечка', 'ванёк', 'ванюша', 'ванька', 'ivan', 'vanya', 'vanyusha'],
  ['игорь', 'игорёк', 'игорёша', 'игорян', 'igor'],
  ['илья', 'илье', 'илью', 'илюша', 'илюше', 'илюха', 'илюхе', 'илюшка', 'иля', 'ilya', 'ilja', 'ilyusha'],
  ['кирилл', 'кириллу', 'кирилла', 'кирюша', 'кирюше', 'кирюшу', 'кирюха', 'кирюхе', 'кирюху', 'кирюшка', 'киря', 'кире', 'кир', 'киру', 'kirill', 'kyrill', 'kiryusha'],
  ['константин', 'костя', 'костик', 'косик', 'костян', 'konstantin', 'kostya', 'kostik'],
  ['лев', 'лёва', 'лёвка', 'lev', 'leo', 'lyova'],
  ['леонид', 'лёня', 'лёнька', 'лёнечка', 'leonid', 'lyonya'],
  ['лука', 'лукаша', 'luka', 'lucas', 'luke'],
  ['матвей', 'матвейка', 'matvey', 'matvei', 'matthew'],
  ['максим', 'макс', 'максик', 'максимка', 'maxim', 'max', 'maksim'],
  ['михаил', 'миша', 'мишка', 'мишаня', 'мишул', 'mikhail', 'misha', 'michael', 'mishanya'],
  ['никита', 'ника', 'никиташка', 'nikita', 'nick', 'nika'],
  ['николай', 'коля', 'колян', 'колька', 'коляша', 'nikolay', 'kolya', 'nicolas', 'nikolai'],
  ['олег', 'олежа', 'олежка', 'олежик', 'oleg', 'olezhka'],
  ['павел', 'паша', 'пашка', 'пашок', 'пашуля', 'pavel', 'pasha', 'paul'],
  ['пётр', 'петр', 'петя', 'петька', 'петруша', 'petr', 'petya', 'peter', 'pyotr'],
  ['роман', 'рома', 'ромка', 'ромчик', 'roman', 'roma'],
  ['руслан', 'руся', 'русик', 'ruslan', 'rusya'],
  ['семён', 'семен', 'сёма', 'сёмка', 'семенит', 'semyon', 'syoma', 'semen'],
  ['сергей', 'серёжа', 'серёга', 'серж', 'серый', 'серёженька', 'sergey', 'sergei', 'serge', 'seryozha'],
  ['станислав', 'стас', 'стасик', 'stanislav', 'stas', 'stasik'],
  ['степан', 'стёпа', 'стёпка', 'stepan', 'styopa', 'stepka'],
  ['тимофей', 'тимоша', 'тимошка', 'timofey', 'timofei', 'timosha'],
  ['тимур', 'тимурик', 'timur'],
  ['фёдор', 'федор', 'федя', 'фёдька', 'фёдечка', 'fedor', 'fyodor', 'fedya'],
  ['филипп', 'филя', 'филька', 'philip', 'phillip', 'filip'],
  ['эдуард', 'эдик', 'эдя', 'эдуардик', 'edward', 'edik', 'eduik'],
  ['юрий', 'юра', 'юрка', 'юрочка', 'yury', 'yuri', 'yura', 'jury'],
  ['яков', 'яша', 'яшка', 'yakov', 'yasha', 'jacob'],
  ['ярослав', 'ярик', 'ярославик', 'yaroslav', 'yarik'],

  // ═══════════════ ЖЕНСКИЕ ИМЕНА ═══════════════

  ['александра', 'саша', 'саня', 'шура', 'алекса', 'сашка', 'alexandra', 'sasha', 'alex'],
  ['алина', 'алинка', 'алиночка', 'alina', 'alinka'],
  ['алиса', 'алисочка', 'алиска', 'alice', 'alisa'],
  ['алёна', 'алена', 'лена', 'алёнка', 'алёнушка', 'alyona', 'alena', 'alenka'],
  ['анастасия', 'настя', 'ася', 'стася', 'насточка', 'настёна', 'настенька', 'anastasia', 'nastya', 'asya'],
  ['анна', 'аня', 'анечка', 'нюша', 'анюта', 'нюра', 'аннушка', 'anna', 'anya', 'nyusha', 'anyuta'],
  ['валентина', 'валя', 'валечка', 'valentina', 'valya'],
  ['валерия', 'лера', 'лерочка', 'лерок', 'лерочч', 'valeria', 'lera', 'lerochka', 'leroch'],
  ['вера', 'верочка', 'верка', 'vera'],
  ['вероника', 'ника', 'вероничка', 'veranika', 'veronika', 'veronica', 'nika'],
  ['виктория', 'вика', 'викуся', 'виктоша', 'викка', 'viktoria', 'victoria', 'vika'],
  ['галина', 'галя', 'галечка', 'galina', 'galya'],
  ['дарья', 'даша', 'дашуля', 'дашутка', 'дашка', 'дарина', 'dasha', 'darya', 'daria'],
  ['диана', 'дианочка', 'дианка', 'diana'],
  ['екатерина', 'катя', 'катюша', 'катюха', 'катенька', 'катуся', 'kate', 'ekaterina', 'katya', 'katyusha'],
  ['елена', 'лена', 'леночка', 'алёна', 'лёна', 'elena', 'helen', 'lena', 'alyona'],
  ['елизавета', 'лиза', 'лизавета', 'лизочка', 'lizaveta', 'elizabeth', 'liza', 'elizaveta'],
  ['жанна', 'жанночка', 'zhanna', 'jeanne'],
  ['зинаида', 'зина', 'зиночка', 'zinaida', 'zina'],
  ['зоя', 'зоечка', 'zoya'],
  ['инна', 'иннка', 'inna'],
  ['ирина', 'ира', 'иришка', 'иринка', 'ируся', 'irina', 'ira', 'irisha'],
  ['карина', 'каринка', 'каришка', 'karina', 'karinka'],
  ['кристина', 'кристи', 'кристинка', 'kristina', 'christina', 'cristi'],
  ['ксения', 'ксюша', 'ксюха', 'ксюшка', 'kseniya', 'ksenia', 'xenia', 'ksyusha'],
  ['лариса', 'лара', 'ларочка', 'larisa', 'lara'],
  ['лидия', 'лида', 'лидочка', 'lidia', 'lida'],
  ['лилия', 'лиля', 'лилечка', 'liliya', 'lilia', 'lily'],
  ['людмила', 'люда', 'мила', 'людок', 'людочка', 'lyudmila', 'lyuda', 'mila'],
  ['маргарита', 'рита', 'маргоша', 'марго', 'ритуся', 'margarita', 'rita', 'margo'],
  ['мария', 'маша', 'машенька', 'машка', 'машуля', 'maria', 'mary', 'masha', 'mashenka'],
  ['милена', 'мила', 'milena', 'mila'],
  ['надежда', 'надя', 'надечка', 'надюша', 'nadezhda', 'nadya'],
  ['наталья', 'наталия', 'наташа', 'наташка', 'таша', 'натуся', 'natasha', 'natalia', 'natalya', 'tasha'],
  ['нина', 'ниночка', 'нинуля', 'nina'],
  ['оксана', 'оксанка', 'оксаночка', 'oksana', 'oksanka'],
  ['олеся', 'олесенька', 'olesya'],
  ['ольга', 'оля', 'олечка', 'ольгуша', 'оленька', 'olga', 'olya'],
  ['полина', 'поля', 'полинка', 'полюша', 'полечка', 'polina', 'polya'],
  ['регина', 'реги', 'ренечка', 'regina'],
  ['светлана', 'света', 'светочка', 'светик', 'свето', 'svetlana', 'sveta'],
  ['снежана', 'снежа', 'снежанка', 'snezhana', 'snezha'],
  ['sofia', 'соня', 'сонечка', 'сонька', 'соф', 'sofya', 'sofia', 'sophia', 'sonya'],
  ['тамара', 'тома', 'тамарочка', 'tamara', 'toma'],
  ['татьяна', 'таня', 'танечка', 'татьянка', 'танюша', 'tatyana', 'tatiana', 'tanya'],
  ['ульяна', 'уля', 'уленька', 'ulyana', 'ulya'],
  ['эльвира', 'вира', 'elvira', 'vira'],
  ['элина', 'элинка', 'elina'],
  ['яна', 'яночка', 'янка', 'yana'],
  ['юлия', 'юля', 'юлечка', 'юлик', 'юленька', 'yuliya', 'julia', 'yulya', 'julie'],
]

/**
 * Быстрый lookup: любая форма имени → её кластер
 */
export const NAME_TO_CLUSTER_MAP = new Map<string, string[]>()
for (const cluster of NAME_CLUSTERS) {
  for (const name of cluster) {
    NAME_TO_CLUSTER_MAP.set(name.toLowerCase(), cluster)
  }
}

/**
 * Проверяет, относятся ли два имени к одному и тому же человеку.
 * Например: 'ваня' + 'иван' → true, 'маша' + 'мария' → true
 */
export function namesAreRelated(a: string, b: string): boolean {
  const aL = a.toLowerCase().trim()
  const bL = b.toLowerCase().trim()
  if (aL === bL) return true
  const aCluster = NAME_TO_CLUSTER_MAP.get(aL)
  const bCluster = NAME_TO_CLUSTER_MAP.get(bL)
  if (!aCluster || !bCluster) return false
  // Если ссылки на один и тот же массив — это один кластер
  return aCluster === bCluster
}

/**
 * Находит все формы имени для заданного слова
 */
export function getNameCluster(name: string): string[] | null {
  return NAME_TO_CLUSTER_MAP.get(name.toLowerCase().trim()) || null
}

/**
 * Проверяет, совпадает ли queryToken с любой формой candidateName через кластеры
 */
export function tokenMatchesCandidateName(queryToken: string, candidateNames: string[]): boolean {
  const qL = queryToken.toLowerCase().trim().replace(/^@/, '')
  const qCluster = NAME_TO_CLUSTER_MAP.get(qL)

  // Russian stem stripping (remove case endings like -е, -у, -ю, -а, -я, -ом, -ем, -ой)
  const qStem = qL.replace(/(?:[еуюая]|ом|ем|ой|ей)$/i, '')

  for (const candidateName of candidateNames) {
    const cL = candidateName.toLowerCase().trim().replace(/^@/, '')
    if (!cL) continue
    if (qL === cL) return true

    const cCluster = NAME_TO_CLUSTER_MAP.get(cL)
    if (qCluster && cCluster && qCluster === cCluster) return true

    const cStem = cL.replace(/(?:[еуюая]|ом|ем|ой|ей)$/i, '')
    if (qStem.length >= 3 && cStem.length >= 3 && (qStem === cStem || qStem.startsWith(cStem) || cStem.startsWith(qStem))) {
      return true
    }

    // Prefix fallback: если имя кандидата начинается с qL (3+ буквы)
    if (qL.length >= 3 && cL.startsWith(qL)) return true
    if (cL.length >= 3 && qL.startsWith(cL)) return true

    // Проверка каждого слова кластера кандидата против каждого слова кластера запроса
    if (qCluster && cCluster) {
      for (const qForm of qCluster) {
        if (cL.startsWith(qForm.slice(0, Math.max(3, qForm.length - 2)))) return true
        if (qForm.startsWith(cL.slice(0, Math.max(3, cL.length - 2)))) return true
      }
    }
  }
  return false
}
