document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculate-btn');
    const salaryInput = document.getElementById('annual-salary');
    const dependentsInput = document.getElementById('dependents');

    const resultArea = document.getElementById('result-area');
    const monthlyNetSalaryEl = document.getElementById('monthly-net-salary');
    const annualNetSalaryEl = document.getElementById('annual-net-salary');
    const overallPercentileEl = document.getElementById('overall-percentile');
    const overallPercentileSubtext = document.getElementById('overall-percentile-subtext');
    const percentileSourcePath = '/.vscode/data/20241231.csv';
    let percentileData = [];
    let maxPercentile = null;

    const formatAsCurrency = (amount) => {
        return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + ' 원';
    };

    const parsePercentileData = (csvText) => {
        const lines = csvText.trim().split('\n');
        if (lines.length <= 1) {
            return [];
        }
        const rows = [];
        for (let i = 1; i < lines.length; i += 1) {
            const cols = lines[i].split(',').map((item) => item.trim());
            const label = cols[0] || '';
            const totalSalary = parseFloat(cols[2]);
            const match = label.match(/상위\s*([0-9.]+)\s*%/);
            if (!match || Number.isNaN(totalSalary)) {
                continue;
            }
            rows.push({
                percentile: parseFloat(match[1]),
                totalSalary
            });
        }
        return rows;
    };

    const loadPercentileData = async () => {
        try {
            const response = await fetch(percentileSourcePath);
            if (!response.ok) {
                throw new Error('failed to load percentile data');
            }
            const buffer = await response.arrayBuffer();
            let csvText = '';
            try {
                csvText = new TextDecoder('euc-kr').decode(buffer);
            } catch (decodeError) {
                csvText = new TextDecoder('utf-8').decode(buffer);
            }
            percentileData = parsePercentileData(csvText);
            maxPercentile = percentileData.reduce((max, row) => Math.max(max, row.percentile), 0);
            updatePercentileDisplay();
        } catch (error) {
            overallPercentileEl.textContent = '-';
            overallPercentileSubtext.textContent = '데이터 로드 실패';
        }
    };

    const computePercentileFromData = (annualSalaryMan) => {
        if (!percentileData.length) {
            return null;
        }
        const annualSalaryThousand = annualSalaryMan * 10;
        let bestMatch = null;
        percentileData.forEach((row) => {
            if (annualSalaryThousand >= row.totalSalary) {
                if (!bestMatch || row.percentile < bestMatch.percentile) {
                    bestMatch = row;
                }
            }
        });
        return bestMatch ? bestMatch.percentile : null;
    };

    let latestMonthlyNetSalary = null;
    let latestAnnualSalaryMan = null;

    const updatePercentileDisplay = () => {
        if (!latestMonthlyNetSalary || latestAnnualSalaryMan === null) {
            return;
        }

        const percentile = computePercentileFromData(latestAnnualSalaryMan);
        if (percentile === null) {
            overallPercentileEl.textContent = maxPercentile ? `상위 ${maxPercentile}% 밖` : '-';
            overallPercentileSubtext.textContent = maxPercentile ? '데이터 범위 외' : '데이터 로딩 중';
            return;
        }
        overallPercentileEl.textContent = `상위 ${percentile}%`;
        overallPercentileSubtext.textContent = '국세청 근로소득 기준';
    };

    loadPercentileData();

    calculateBtn.addEventListener('click', () => {
        const annualSalaryInput = parseFloat(salaryInput.value);
        const dependents = parseInt(dependentsInput.value, 10);

        // 1. 입력값 검증
        if (isNaN(annualSalaryInput) || annualSalaryInput <= 0) {
            alert('올바른 연봉을 입력해주세요.');
            salaryInput.focus();
            return;
        }

        const annualSalary = annualSalaryInput * 10000;

        // 2. 공제액 계산 (단순화된 모델)
        const monthlySalary = annualSalary / 12;

        // 국민연금 (4.5%)
        const nationalPension = monthlySalary * 0.045;
        // 건강보험 (3.545%) + 장기요양 (건강보험의 12.81%)
        const healthInsurance = monthlySalary * 0.03545;
        const longTermCareInsurance = healthInsurance * 0.1281;
        // 고용보험 (0.9%)
        const employmentInsurance = monthlySalary * 0.009;

        // 소득세 (근로소득 간이세액표 기준 단순화)
        let incomeTax = 0;
        const taxBase = monthlySalary - (nationalPension + healthInsurance + employmentInsurance);
        
        // 부양가족 수에 따른 기본 공제 단순화
        const dependentDeduction = 150000 * (dependents - 1); 
        
        // 과세표준에 따른 세율 단순 적용
        if (taxBase > 8000000) {
            incomeTax = taxBase * 0.20 - dependentDeduction;
        } else if (taxBase > 4000000) {
            incomeTax = taxBase * 0.15 - dependentDeduction;
        } else if (taxBase > 1500000) {
            incomeTax = taxBase * 0.10 - dependentDeduction;
        } else {
            incomeTax = taxBase * 0.06 - dependentDeduction;
        }
        incomeTax = Math.max(0, incomeTax); // 세금은 음수가 될 수 없음

        // 지방소득세 (소득세의 10%)
        const localIncomeTax = incomeTax * 0.1;

        const totalMonthlyDeduction =
            nationalPension +
            healthInsurance +
            longTermCareInsurance +
            employmentInsurance +
            incomeTax +
            localIncomeTax;

        // 3. 실수령액 계산
        const monthlyNetSalary = monthlySalary - totalMonthlyDeduction;
        const annualNetSalary = monthlyNetSalary * 12;

        // 4. 결과 표시
        monthlyNetSalaryEl.textContent = formatAsCurrency(monthlyNetSalary);
        annualNetSalaryEl.textContent = formatAsCurrency(annualNetSalary);

        latestMonthlyNetSalary = monthlyNetSalary;
        latestAnnualSalaryMan = annualSalaryInput;
        updatePercentileDisplay();

        resultArea.style.display = 'block';
    });

    const handleEnterKey = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            calculateBtn.click();
        }
    };

    salaryInput.addEventListener('keydown', handleEnterKey);
    dependentsInput.addEventListener('keydown', handleEnterKey);
});
