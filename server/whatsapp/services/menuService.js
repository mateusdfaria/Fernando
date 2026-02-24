const { getMenuOptions } = require('../../database');

const getMenuService = () => {
    return {
        generateMenuText: async () => {
            const options = await getMenuOptions();

            if (options.length === 0) {
                return '⚠️ Nenhuma opção cadastrada ainda.';
            }

            let menuText = '🛍️ *MENU PRINCIPAL*\n\n';
            menuText += 'Escolha uma opção:\n\n';

            options.forEach(option => {
                const optionNum = option.option_number || option.id;
                menuText += `${optionNum} - ${option.title}\n`;
            });

            menuText += '\nDigite o número da opção desejada.';
            return menuText;
        }
    };
};

module.exports = { getMenuService };
