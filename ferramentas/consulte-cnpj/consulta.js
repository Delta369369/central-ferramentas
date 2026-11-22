const status = document.querySelector('#status');
const result = document.querySelector('#result');
const input = document.querySelector('#cnpj');

const labels = {
  taxId: 'CNPJ ou CPF', updated: 'Atualização dos dados', company: 'Empresa',
  name: 'Nome', alias: 'Nome fantasia', founded: 'Data de abertura', head: 'É matriz',
  statusDate: 'Data da situação cadastral', status: 'Situação', reason: 'Motivo',
  specialDate: 'Data da situação especial', special: 'Situação especial',
  phones: 'Telefones', emails: 'E-mails', mainActivity: 'Atividade principal',
  sideActivities: 'Atividades secundárias', address: 'Endereço',
  municipality: 'Código do município', street: 'Logradouro', number: 'Número',
  district: 'Bairro', city: 'Cidade', state: 'Estado', details: 'Complemento',
  zip: 'CEP', country: 'País', equity: 'Capital social', jurisdiction: 'Jurisdição',
  nature: 'Natureza jurídica', size: 'Porte', members: 'Quadro de sócios e administradores',
  person: 'Pessoa', since: 'Desde', role: 'Qualificação', agent: 'Representante',
  age: 'Faixa etária', type: 'Tipo', text: 'Descrição', id: 'Código',
  acronym: 'Sigla', area: 'DDD', ownership: 'Titularidade', domain: 'Domínio',
  simples: 'Simples Nacional', simei: 'SIMEI', optant: 'Optante',
  history: 'Histórico', events: 'Eventos', registrations: 'Inscrições estaduais',
  suframa: 'Suframa', approved: 'Aprovado', approvalDate: 'Data de aprovação',
  incentives: 'Incentivos'
};

function labelFor(key) {
  return Object.hasOwn(labels, key) ? labels[key] : key;
}

function element(tag, content) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
}

function renderValue(value) {
  if (value === null || value === '') return element('span', 'Não informado');
  if (typeof value === 'boolean') return element('span', value ? 'Sim' : 'Não');
  if (Array.isArray(value)) {
    if (value.length === 0) return element('span', 'Nenhum registro retornado');
    const list = element('ol');
    for (const item of value) {
      const row = element('li');
      row.append(renderValue(item));
      list.append(row);
    }
    return list;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return element('span', 'Nenhum dado retornado');
    const list = element('dl');
    for (const [key, item] of entries) {
      const row = element('div');
      row.className = 'field';
      const detail = element('dd');
      detail.append(renderValue(item));
      row.append(element('dt', labelFor(key)), detail);
      list.append(row);
    }
    return list;
  }
  return element('span', String(value));
}

async function consult(cnpj) {
  status.textContent = 'Consultando o CNPJá…';
  try {
    const response = await fetch('https://open.cnpja.com/office/' + cnpj, {
      signal: AbortSignal.timeout(15000)
    });
    if (response.status === 404) {
      throw new Error('CNPJ não encontrado na base do CNPJá.');
    }
    if (response.status === 429) {
      throw new Error('O limite de consultas do CNPJá foi atingido. Aguarde um minuto e tente novamente.');
    }
    if (response.status === 400 || response.status === 422) {
      throw new Error('O CNPJá rejeitou o CNPJ informado. Confira o número.');
    }
    if (!response.ok) {
      throw new Error('O CNPJá está indisponível para esta consulta. Tente novamente em instantes.');
    }
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('O CNPJá retornou um formato inesperado.');
    }
    document.querySelector('#company-name').textContent = data.company?.name || 'Dados do CNPJ';
    document.querySelector('#raw').textContent = JSON.stringify(data, null, 2);

    const summary = {};
    const panels = document.createDocumentFragment();
    for (const [key, value] of Object.entries(data)) {
      if (value === null || typeof value !== 'object') {
        Object.defineProperty(summary, key, { value, enumerable: true });
        continue;
      }
      const section = element('section');
      section.className = 'panel';
      section.append(element('h3', labelFor(key)), renderValue(value));
      panels.append(section);
    }

    const identification = element('section');
    identification.className = 'panel';
    identification.append(element('h3', 'Identificação'), renderValue(summary));
    document.querySelector('#fields').replaceChildren(identification, panels);
    result.hidden = false;
    status.textContent = 'Consulta concluída.';
  } catch (error) {
    status.dataset.error = '';
    status.textContent = error.name === 'TimeoutError'
      ? 'A consulta demorou demais. Tente novamente.'
      : error instanceof TypeError || error instanceof SyntaxError
        ? 'Falha ao receber os dados do CNPJá. Tente novamente.'
        : error.message;
  }
}

const entered = new URLSearchParams(location.search).get('cnpj');
if (entered !== null) {
  input.value = entered.trim();
  if (input.checkValidity()) {
    consult(input.value.replace(/\D/g, ''));
  } else {
    status.dataset.error = '';
    status.textContent = 'Digite os 14 números do CNPJ, com ou sem pontuação.';
  }
}
