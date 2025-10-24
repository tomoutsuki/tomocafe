module.exports = async (message) => {

    const woodenDividerBig = 'https://i.imgur.com/WbBZ0o1.png';
    const woodenDividerSmall = 'https://i.imgur.com/IY518h5.png';
    const logoImage = 'https://i.imgur.com/Movqv3G.png';
    const titleDivider = {
        aboutMe: 'https://i.imgur.com/WhxCPLE.png',
        commandList: 'https://i.imgur.com/oJLirFY.png',
        patchNote: 'https://i.imgur.com/99Jae5A.png',
    }

    const aboutMeText = `
        **いらっしゃいませ～！:coffee::sparkles:**
        私は『友カフェちゃん』。
        みんながゆったり話せるように、ちょっとしたお手伝いをしてるバリスタBOTです♪
        今日も美味しいコーヒーと、楽しいおしゃべり、たくさん楽しんでくださいね。
        もし疲れたら、私に『！メニュー』って話しかけてください。甘いもの、ありますよ:cake:
    `;


    const commandListText = `
        ## :blossom: チャット関連コマンド
        雑談やトークのきっかけに使えるメニューです。

        **【 ！メニュー 】**  今日のおすすめ『スイーツ:cake:』と『ドリンク:coffee:』を紹介します！
        **【 ！話題 】** ランダムな話題を提供します。雑談に困ったときにどうぞ！
        **【 ！深夜 】** 深夜テンションなカオス話題をお届けします。夜更かしのお供に:crescent_moon:

        ## :coffee: コーヒー関連コマンド
        コーヒー豆（通貨）を貯めて、お買い物やイベントに参加できます！

        **【 ！日給 】** 一日に一回、ランダムな数のコーヒー豆をもらえます！
        **【 ！残高 】** 所持しているコーヒー豆の残高を確認します。

        ## :gift: アイテム関連コマンド
        カフェで手に入れたアイテムを確認したり、コレクションを楽しめます。

        **【 ！インベントリ 】** 所持しているアイテム一覧を確認します。  
    `;

    const patchNoteText = `
        ### v.0.9.5-beta
        【新機能】
        ・自動登録機能を追加：新しいメンバーが追加された際、自動的に登録されるようになりました。
        ・管理者専用ブロック機能を追加：管理者のみが通行・操作できる領域を設定できるようになりました。

        【改善・修正】
        インベントリUIの修正：表示不具合を修正し、アイテム一覧が正しく表示されるようになりました。

        アイテム関連バグ修正：
        ・citem コマンドのバグを修正。
        ・gitem コマンドのバグを修正。
    `;
    
    await sendGuideSection(message, woodenDividerBig);
    await sendGuideSection(message, logoImage);

    await sendGuideSection(message, titleDivider.aboutMe);
    await sendGuideSection(message, aboutMeText);

    await sendGuideSection(message, titleDivider.commandList);
    await sendGuideSection(message, commandListText);

    await sendGuideSection(message, titleDivider.patchNote);
    await sendGuideSection(message, patchNoteText);

    await sendGuideSection(message, woodenDividerBig);
    
}

async function sendGuideSection(message,content) {
    await message.channel.send({content: content,});
    await sleep(300);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}